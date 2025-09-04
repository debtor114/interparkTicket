// 분석 결과 내보내기 유틸리티
class ExportUtils {
    
    // JSON 파일로 다운로드
    static downloadJSON(data, filename = 'interpark-analysis.json') {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`✅ ${filename} 다운로드 완료`);
    }
    
    // 현재 페이지 분석 결과 내보내기
    static exportCurrentPageAnalysis() {
        const analysis = {
            site: 'interpark',
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toISOString(),
            
            // 기본 페이지 정보
            pageInfo: {
                domain: window.location.hostname,
                path: window.location.pathname,
                userAgent: navigator.userAgent
            },
            
            // 티켓팅 관련 요소들
            elements: {
                // 예매/예약 링크들
                ticketLinks: Array.from(document.querySelectorAll('a[href*="/ticket"], a[href*="/goods/"]'))
                    .slice(0, 10)
                    .map(el => ({
                        text: el.textContent?.trim(),
                        href: el.href,
                        className: el.className
                    })),
                
                // 로그인 관련
                loginElements: Array.from(document.querySelectorAll('a[href*="login"], [class*="login"]'))
                    .map(el => ({
                        text: el.textContent?.trim(),
                        href: el.href || '',
                        tag: el.tagName
                    })),
                
                // 주요 버튼들
                buttons: Array.from(document.querySelectorAll('button, [role="button"]'))
                    .slice(0, 20)
                    .map(el => ({
                        text: el.textContent?.trim(),
                        className: el.className,
                        type: el.type || 'button'
                    })),
                
                // 폼 요소들
                forms: Array.from(document.querySelectorAll('form'))
                    .map(form => ({
                        action: form.action,
                        method: form.method,
                        fieldCount: form.querySelectorAll('input, select, textarea').length
                    })),
                
                // 네비게이션 메뉴
                navigation: Array.from(document.querySelectorAll('nav a, .nav a, [class*="menu"] a'))
                    .slice(0, 15)
                    .map(el => ({
                        text: el.textContent?.trim(),
                        href: el.href
                    }))
            },
            
            // 통계
            statistics: {
                totalLinks: document.querySelectorAll('a').length,
                totalButtons: document.querySelectorAll('button, [role="button"]').length,
                totalForms: document.querySelectorAll('form').length,
                totalImages: document.querySelectorAll('img').length,
                ticketRelatedLinks: document.querySelectorAll('a[href*="/ticket"], a[href*="/goods/"]').length
            }
        };
        
        const filename = `interpark-analysis-${Date.now()}.json`;
        ExportUtils.downloadJSON(analysis, filename);
        
        return analysis;
    }
    
    // 셀렉터 맵 생성 및 내보내기
    static exportSelectorMap() {
        const selectorMap = {
            timestamp: new Date().toISOString(),
            site: 'interpark',
            url: window.location.href,
            
            selectors: {
                // 예매 관련
                ticketButtons: [
                    'a[href*="/ticket"]',
                    'a[href*="/goods/"]',
                    '.btn[href*="ticket"]'
                ],
                
                // 로그인 관련
                loginElements: [
                    'a[href*="login"]',
                    '[class*="login"]',
                    'button[onclick*="login"]'
                ],
                
                // 검색 관련
                searchElements: [
                    'input[type="search"]',
                    '[class*="search"] input',
                    '#search'
                ],
                
                // 네비게이션
                mainNavigation: [
                    'nav a',
                    '.nav a',
                    '[class*="menu"] a'
                ]
            },
            
            // 자동화용 XPath들
            xpaths: {
                firstTicketLink: ExportUtils.getXPath(document.querySelector('a[href*="/ticket"]')),
                loginButton: ExportUtils.getXPath(document.querySelector('a[href*="login"]')),
                searchInput: ExportUtils.getXPath(document.querySelector('input[type="search"]'))
            }
        };
        
        const filename = `interpark-selectors-${Date.now()}.json`;
        ExportUtils.downloadJSON(selectorMap, filename);
        
        return selectorMap;
    }
    
    // XPath 생성
    static getXPath(element) {
        if (!element) return null;
        
        if (element.id) {
            return `//*[@id="${element.id}"]`;
        }
        
        let path = '';
        while (element && element.nodeType === Node.ELEMENT_NODE) {
            let index = 0;
            let sibling = element.previousSibling;
            
            while (sibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
                    index++;
                }
                sibling = sibling.previousSibling;
            }
            
            const tagName = element.nodeName.toLowerCase();
            const pathIndex = index > 0 ? `[${index + 1}]` : '';
            path = `/${tagName}${pathIndex}${path}`;
            
            element = element.parentNode;
        }
        
        return path;
    }
}

// 전역 사용을 위해 window 객체에 등록
window.ExportUtils = ExportUtils;