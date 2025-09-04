// DOM 분석 결과 처리 클래스
class DOMAnalyzer {
    
    // DOM 분석 결과 처리
    static async handleDOMAnalysis(analysisData, tab) {
        console.log('🔍 DOM 분석 결과 수신:', analysisData);
        
        await DOMAnalyzer.saveDOMAnalysis(analysisData, tab);
        DOMAnalyzer.updateSelectorPatterns(analysisData);
        DOMAnalyzer.prepareDOMDataForElectron(analysisData, tab);
        
        const automationScript = DOMAnalyzer.generateAutomationScript(analysisData);
        
        console.log('✅ DOM 분석 처리 완료');
        return automationScript;
    }

    // DOM 분석 결과를 Chrome storage에 저장
    static async saveDOMAnalysis(analysisData, tab) {
        const storageKey = `dom_analysis_${tab.id}_${Date.now()}`;
        const dataToSave = {
            ...analysisData,
            tabId: tab.id,
            tabUrl: tab.url,
            savedAt: new Date().toISOString()
        };

        try {
            await chrome.storage.local.set({
                [storageKey]: dataToSave,
                [`latest_analysis_${DOMAnalyzer.getSiteKey(analysisData.site)}`]: dataToSave
            });
            console.log('DOM 분석 결과 저장 완료:', storageKey);
        } catch (error) {
            console.error('DOM 분석 결과 저장 실패:', error);
        }
    }

    // 사이트별 셀렉터 패턴 업데이트
    static updateSelectorPatterns(analysisData) {
        const siteKey = DOMAnalyzer.getSiteKey(analysisData.site);
        const patterns = DOMAnalyzer.extractSelectorPatterns(analysisData);
        
        chrome.storage.local.get([`selector_patterns_${siteKey}`]).then((result) => {
            const existingPatterns = result[`selector_patterns_${siteKey}`] || {};
            const mergedPatterns = DOMAnalyzer.mergePatterns(existingPatterns, patterns);
            
            chrome.storage.local.set({
                [`selector_patterns_${siteKey}`]: mergedPatterns
            });
            
            console.log(`${siteKey} 사이트의 셀렉터 패턴 업데이트 완료`);
        });
    }

    // 셀렉터 패턴 추출
    static extractSelectorPatterns(analysisData) {
        const patterns = {
            reservationButtons: [],
            seatSelectors: [],
            priceElements: [],
            dateSelectors: [],
            quantitySelectors: [],
            paymentButtons: [],
            loginElements: []
        };

        Object.keys(patterns).forEach(elementType => {
            const elements = analysisData.elements[elementType] || [];
            elements.forEach(element => {
                patterns[elementType].push({
                    xpath: element.xpath,
                    selector: DOMAnalyzer.generateCSSSelector(element),
                    textPattern: element.text,
                    confidence: DOMAnalyzer.calculateConfidence(element, elementType),
                    lastSeen: new Date().toISOString()
                });
            });
        });

        return patterns;
    }

    // CSS 선택자 생성
    static generateCSSSelector(element) {
        let selector = element.tag.toLowerCase();
        
        if (element.id) {
            selector += `#${element.id}`;
        }
        
        if (element.className) {
            const classes = element.className.split(' ')
                .filter(cls => cls.trim())
                .slice(0, 3);
            if (classes.length > 0) {
                selector += '.' + classes.join('.');
            }
        }

        return selector;
    }

    // 요소의 신뢰도 계산
    static calculateConfidence(element, elementType) {
        let confidence = 0.5;

        if (element.visible) confidence += 0.2;
        
        if (element.onclick || element.styles.cursor === 'pointer') {
            confidence += 0.2;
        }

        const relevantKeywords = DOMAnalyzer.getRelevantKeywords(elementType);
        const text = (element.text || '').toLowerCase();
        const matchCount = relevantKeywords.filter(keyword => 
            text.includes(keyword)
        ).length;
        
        confidence += Math.min(matchCount * 0.1, 0.3);

        return Math.min(confidence, 1.0);
    }

    // 요소 타입별 관련 키워드 반환
    static getRelevantKeywords(elementType) {
        const keywords = {
            reservationButtons: ['예매', '예약', '구매', 'book', 'reserve', 'buy'],
            seatSelectors: ['좌석', 'seat', 'chair'],
            priceElements: ['원', 'price', 'cost', 'fee'],
            dateSelectors: ['날짜', 'date', 'calendar'],
            quantitySelectors: ['수량', 'qty', 'quantity', 'count'],
            paymentButtons: ['결제', 'payment', 'pay', 'checkout'],
            loginElements: ['로그인', 'login', 'id', 'password']
        };
        
        return keywords[elementType] || [];
    }

    // 패턴 병합
    static mergePatterns(existing, newPatterns) {
        const merged = { ...existing };
        
        Object.keys(newPatterns).forEach(elementType => {
            if (!merged[elementType]) {
                merged[elementType] = [];
            }
            
            newPatterns[elementType].forEach(newPattern => {
                const isDuplicate = merged[elementType].some(existing => 
                    existing.xpath === newPattern.xpath || 
                    existing.selector === newPattern.selector
                );
                
                if (!isDuplicate) {
                    merged[elementType].push(newPattern);
                }
            });
        });
        
        return merged;
    }

    // Electron 앱용 데이터 준비
    static prepareDOMDataForElectron(analysisData, tab) {
        const electronData = {
            site: analysisData.site,
            url: analysisData.url,
            timestamp: analysisData.timestamp,
            elements: DOMAnalyzer.simplifyElementsForElectron(analysisData.elements),
            automationScript: DOMAnalyzer.generateAutomationScript(analysisData),
            selectorMap: DOMAnalyzer.createSelectorMap(analysisData)
        };

        chrome.storage.local.set({
            [`electron_data_${DOMAnalyzer.getSiteKey(analysisData.site)}`]: electronData
        });

        console.log('Electron 앱용 데이터 준비 완료');
    }

    // Electron용 요소 데이터 단순화
    static simplifyElementsForElectron(elements) {
        const simplified = {};
        
        Object.keys(elements).forEach(elementType => {
            simplified[elementType] = elements[elementType].map(element => ({
                type: element.type,
                xpath: element.xpath,
                selector: DOMAnalyzer.generateCSSSelector(element),
                text: element.text,
                visible: element.visible,
                confidence: DOMAnalyzer.calculateConfidence(element, elementType)
            }));
        });

        return simplified;
    }

    // 셀렉터 맵 생성
    static createSelectorMap(analysisData) {
        const selectorMap = {};
        
        Object.keys(analysisData.elements).forEach(elementType => {
            const elements = analysisData.elements[elementType];
            if (elements.length > 0) {
                const bestElement = elements.reduce((best, current) => {
                    const currentConfidence = DOMAnalyzer.calculateConfidence(current, elementType);
                    const bestConfidence = DOMAnalyzer.calculateConfidence(best, elementType);
                    return currentConfidence > bestConfidence ? current : best;
                });
                
                selectorMap[elementType] = {
                    primary: bestElement.xpath,
                    fallback: DOMAnalyzer.generateCSSSelector(bestElement),
                    text: bestElement.text
                };
            }
        });

        return selectorMap;
    }

    // 자동화 스크립트 생성
    static generateAutomationScript(analysisData) {
        const script = {
            site: analysisData.site,
            url: analysisData.url,
            actions: [],
            selectors: DOMAnalyzer.createSelectorMap(analysisData)
        };

        if (analysisData.elements.reservationButtons?.length > 0) {
            script.actions.push({
                type: 'click',
                target: 'reservationButton',
                selector: script.selectors.reservationButtons?.primary,
                description: '예매 버튼 클릭'
            });
        }

        if (analysisData.elements.seatSelectors?.length > 0) {
            script.actions.push({
                type: 'click',
                target: 'seatSelector',
                selector: script.selectors.seatSelectors?.primary,
                description: '좌석 선택'
            });
        }

        if (analysisData.elements.paymentButtons?.length > 0) {
            script.actions.push({
                type: 'click',
                target: 'paymentButton',
                selector: script.selectors.paymentButtons?.primary,
                description: '결제 진행'
            });
        }

        return script;
    }

    // 사이트 키 생성
    static getSiteKey(site) {
        return site.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    }
}

// 전역 사용을 위해 window 객체에 등록
window.DOMAnalyzer = DOMAnalyzer;