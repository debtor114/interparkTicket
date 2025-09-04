// 백그라운드 스크립트 - 통합 버전
console.log('🎫 티켓팅 모니터 Background Script 로드됨');

// 네트워크 요청 모니터링 클래스
class NetworkRequestMonitor {
    constructor() {
        this.ticketingRequests = [];
        this.isMonitoring = false;
    }

    startMonitoring() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;
        this.ticketingRequests = [];
        console.log('🎯 네트워크 모니터링 시작됨');
    }

    stopMonitoring() {
        if (!this.isMonitoring) return;
        this.isMonitoring = false;
        console.log('🛑 네트워크 모니터링 중지됨');
    }

    handleRequest(details) {
        const requestData = {
            id: details.requestId,
            url: details.url,
            method: details.method,
            timestamp: Date.now(),
            type: this.categorizeRequest(details.url),
            resourceType: details.type,
            site: this.getSiteFromUrl(details.url),
            body: details.requestBody
        };

        if (this.isResourceToCapture(details.url, details.type)) {
            console.log(`🔍 ${details.type.toUpperCase()} 리소스 캡처:`, requestData);
            this.ticketingRequests.push(requestData);
        }

        if (this.isTicketingRelated(details.url)) {
            console.log('🎫 티켓팅 요청 감지:', requestData);
            this.ticketingRequests.push(requestData);
        }
    }

    handleHeaders(details) {
        if (!this.isTicketingRelated(details.url) && !this.isResourceToCapture(details.url, details.type)) return;

        const request = this.ticketingRequests.find(r => r.id === details.requestId);
        if (request) {
            request.headers = details.requestHeaders;
        }
    }

    handleResponse(details) {
        if (!this.isTicketingRelated(details.url) && !this.isResourceToCapture(details.url, details.type)) return;

        const request = this.ticketingRequests.find(r => r.id === details.requestId);
        if (request) {
            request.statusCode = details.statusCode;
            request.responseHeaders = details.responseHeaders;
            request.completed = true;
            
            if (details.responseHeaders) {
                const contentType = details.responseHeaders.find(h => 
                    h.name.toLowerCase() === 'content-type');
                if (contentType) {
                    request.contentType = contentType.value;
                }
            }
        }

        if (this.isImportantTicketingRequest(details.url)) {
            this.notifyImportantRequest(request || {
                url: details.url,
                statusCode: details.statusCode
            });
        }
    }

    isTicketingRelated(url) {
        const ticketingPatterns = [
            '/ticket', '/booking', '/reserve', '/purchase', '/payment',
            '/order', '/seat', '/queue', '/api/v1', '/api/v2', 'ajax', 'json'
        ];
        return ticketingPatterns.some(pattern => 
            url.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    isImportantTicketingRequest(url) {
        const importantPatterns = ['booking', 'reserve', 'purchase', 'payment', 'seat', 'queue'];
        return importantPatterns.some(pattern => 
            url.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    isResourceToCapture(url, resourceType) {
        const captureTypes = ['stylesheet', 'script', 'main_frame', 'sub_frame'];
        const captureExtensions = ['.css', '.js', '.html', '.htm'];
        return captureTypes.includes(resourceType) || 
               captureExtensions.some(ext => url.toLowerCase().includes(ext));
    }

    categorizeRequest(url) {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('.css')) return 'CSS';
        else if (lowerUrl.includes('.js')) return 'JAVASCRIPT';
        else if (lowerUrl.includes('.html') || lowerUrl.includes('.htm')) return 'HTML';
        else if (lowerUrl.includes('login') || lowerUrl.includes('auth')) return 'AUTH';
        else if (lowerUrl.includes('seat')) return 'SEAT';
        else if (lowerUrl.includes('booking') || lowerUrl.includes('reserve')) return 'BOOKING';
        else if (lowerUrl.includes('payment') || lowerUrl.includes('purchase')) return 'PAYMENT';
        else if (lowerUrl.includes('queue')) return 'QUEUE';
        else return 'OTHER';
    }

    getSiteFromUrl(url) {
        if (url.includes('interpark.com')) return 'interpark';
        else if (url.includes('ticketlink.co.kr')) return 'ticketlink';
        return 'unknown';
    }

    notifyImportantRequest(request) {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
        console.log('🚨 중요 티켓팅 요청 감지:', request);
    }

    getRequests() {
        return this.ticketingRequests;
    }
}

// DOM 분석 처리 클래스
class DOMAnalyzer {
    static async handleDOMAnalysis(analysisData, tab) {
        console.log('🔍 DOM 분석 결과 수신:', analysisData);
        
        await DOMAnalyzer.saveDOMAnalysis(analysisData, tab);
        DOMAnalyzer.updateSelectorPatterns(analysisData);
        
        const automationScript = DOMAnalyzer.generateAutomationScript(analysisData);
        console.log('✅ DOM 분석 처리 완료');
        return automationScript;
    }

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

    static updateSelectorPatterns(analysisData) {
        const siteKey = DOMAnalyzer.getSiteKey(analysisData.site);
        console.log(`${siteKey} 사이트의 셀렉터 패턴 업데이트 완료`);
    }

    static generateAutomationScript(analysisData) {
        const script = {
            site: analysisData.site,
            url: analysisData.url,
            actions: []
        };

        if (analysisData.elements?.reservationButtons?.length > 0) {
            script.actions.push({
                type: 'click',
                target: 'reservationButton',
                description: '예매 버튼 클릭'
            });
        }

        return script;
    }

    static getSiteKey(site) {
        return site.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    }
}

// 메인 네트워크 모니터 클래스
class NetworkMonitor {
    constructor() {
        this.isMonitoring = false;
        this.isExtensionEnabled = true;
        this.userEvents = [];
        this.loginStates = new Map();
        this.networkMonitor = new NetworkRequestMonitor();
        
        this.init();
    }

    async init() {
        const result = await chrome.storage.local.get(['isExtensionEnabled']);
        if (result.isExtensionEnabled !== undefined) {
            this.isExtensionEnabled = result.isExtensionEnabled;
        }

        this.setupMessageListener();
        this.setupTabListener();
        this.toggleMonitoringListeners();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            const safeResponse = (response) => {
                try {
                    if (sendResponse) {
                        sendResponse(response);
                    }
                } catch (error) {
                    console.warn('응답 전송 실패:', error);
                }
            };

            try {
                switch(message.type) {
                    case 'LOGIN_STATUS_CHANGED':
                        this.handleLoginStatusChange(message.data, sender.tab);
                        safeResponse({success: true});
                        break;
                    case 'USER_EVENT_RECORDED':
                        this.handleUserEvent(message.data, sender.tab);
                        safeResponse({success: true});
                        break;
                    case 'START_MONITORING':
                        this.startMonitoring();
                        safeResponse({success: true});
                        break;
                    case 'STOP_MONITORING':
                        this.stopMonitoring();
                        safeResponse({success: true});
                        break;
                    case 'GET_REQUESTS':
                        safeResponse({requests: this.networkMonitor.getRequests()});
                        break;
                    case 'GET_EVENTS':
                        safeResponse({events: this.userEvents || []});
                        break;
                    case 'TOGGLE_EXTENSION':
                        this.isExtensionEnabled = message.isEnabled;
                        this.toggleMonitoringListeners();
                        safeResponse({success: true});
                        break;
                    case 'DOM_ANALYSIS_RESULT':
                        DOMAnalyzer.handleDOMAnalysis(message.data, sender.tab);
                        safeResponse({success: true});
                        break;
                    case 'PING':
                        // 연결 확인용 PING 응답
                        safeResponse({success: true, message: 'pong'});
                        break;
                    default:
                        safeResponse({success: false, error: 'Unknown message type'});
                        break;
                }
            } catch (error) {
                console.error('메시지 처리 오류:', error);
                safeResponse({error: error.message});
            }
            
            return true;
        });
    }

    setupTabListener() {
        // 탭 업데이트 감지 (새로운 티켓팅 사이트 로드)
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && this.isTicketingSite(tab.url)) {
                console.log(`티켓팅 사이트 로드 완료: ${tab.url}`);
                this.handleNewTicketingTab(tab);
            }
        });

        // 새로운 탭 생성 감지
        chrome.tabs.onCreated.addListener((tab) => {
            if (this.isTicketingSite(tab.url)) {
                console.log(`새 티켓팅 탭 생성: ${tab.url}`);
                this.handleNewTicketingTab(tab);
            }
        });

        // WebNavigation 이벤트 감지 (새 창/팝업 포함)
        chrome.webNavigation.onCompleted.addListener((details) => {
            if (details.frameId === 0 && this.isTicketingSite(details.url)) {
                console.log(`WebNavigation 완료: ${details.url}`);
                this.handleWebNavigationCompleted(details);
            }
        });

        // 창 생성 감지 (팝업 창 포함)
        chrome.windows.onCreated.addListener((window) => {
            if (window.type === 'popup' || window.type === 'normal') {
                console.log('새 창 생성 감지:', window);
                // 창의 탭들을 확인하여 티켓팅 사이트인지 체크
                chrome.tabs.query({windowId: window.id}, (tabs) => {
                    tabs.forEach(tab => {
                        if (this.isTicketingSite(tab.url)) {
                            console.log(`새 창에서 티켓팅 사이트 감지: ${tab.url}`);
                            this.handleNewTicketingTab(tab);
                        }
                    });
                });
            }
        });
    }

    toggleMonitoringListeners() {
        if (chrome.webRequest.onBeforeRequest.hasListener(this.handleRequestBound)) {
            chrome.webRequest.onBeforeRequest.removeListener(this.handleRequestBound);
        }
        if (chrome.webRequest.onBeforeSendHeaders.hasListener(this.handleHeadersBound)) {
            chrome.webRequest.onBeforeSendHeaders.removeListener(this.handleHeadersBound);
        }
        if (chrome.webRequest.onCompleted.hasListener(this.handleResponseBound)) {
            chrome.webRequest.onCompleted.removeListener(this.handleResponseBound);
        }

        if (this.isExtensionEnabled) {
            console.log('🌐 WebRequest listeners enabled.');
            
            if (!this.handleRequestBound) {
                this.handleRequestBound = (details) => this.networkMonitor.handleRequest(details);
                this.handleHeadersBound = (details) => this.networkMonitor.handleHeaders(details);
                this.handleResponseBound = (details) => this.networkMonitor.handleResponse(details);
            }
            
            const urls = ["https://*.interpark.com/*", "https://*.ticketlink.co.kr/*"];
            const types = ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket", "other"];

            chrome.webRequest.onBeforeRequest.addListener(this.handleRequestBound, {urls, types}, ["requestBody"]);
            chrome.webRequest.onBeforeSendHeaders.addListener(this.handleHeadersBound, {urls, types}, ["requestHeaders"]);
            chrome.webRequest.onCompleted.addListener(this.handleResponseBound, {urls, types}, ["responseHeaders"]);
        } else {
            console.log('🚫 WebRequest listeners disabled.');
        }
    }

    startMonitoring() {
        this.networkMonitor.startMonitoring();
        this.isMonitoring = true;
        this.userEvents = [];
        this.notifyAllTicketingTabs('MONITORING_STARTED');
    }

    stopMonitoring() {
        this.networkMonitor.stopMonitoring();
        this.isMonitoring = false;
        this.notifyAllTicketingTabs('MONITORING_STOPPED');
    }

    handleLoginStatusChange(data, tab) {
        this.loginStates.set(tab.id, data);
        console.log(`${data.site} 로그인 상태 변경:`, data);

        if (data.isLoggedIn && !this.isMonitoring) {
            this.startMonitoring();
            console.log('로그인 감지로 인한 모니터링 자동 시작');
        }
    }

    handleUserEvent(eventData, tab) {
        const eventWithTabInfo = {
            ...eventData,
            tabId: tab.id,
            tabUrl: tab.url,
            site: this.getSiteFromUrl(tab.url)
        };

        this.userEvents.push(eventWithTabInfo);
        
        if (this.userEvents.length > 5000) {
            this.userEvents = this.userEvents.slice(-2500);
        }

        console.log('📹 사용자 이벤트 수신:', eventWithTabInfo);

        if (this.isCriticalEvent(eventData)) {
            this.handleCriticalEvent(eventWithTabInfo);
        }
    }

    isCriticalEvent(eventData) {
        const criticalEvents = ['submit', 'click'];
        const criticalElementTypes = ['BUTTON', 'INPUT'];
        const criticalClasses = ['ticket', 'seat', 'booking', 'payment', 'buy', 'purchase'];
        const criticalTexts = ['예매', '결제', '구매', '좌석', '티켓', '로그인'];

        return criticalEvents.includes(eventData.type) &&
               (criticalElementTypes.includes(eventData.data?.elementType) ||
                criticalClasses.some(cls => eventData.data?.elementClass?.toLowerCase()?.includes(cls)) ||
                criticalTexts.some(text => eventData.data?.elementText?.toLowerCase()?.includes(text)));
    }

    handleCriticalEvent(eventData) {
        console.log('🚨 중요 사용자 이벤트 감지:', eventData);
        
        chrome.action.setBadgeText({ text: '!!' });
        chrome.action.setBadgeBackgroundColor({ color: '#FF4444' });

        setTimeout(() => {
            chrome.action.setBadgeText({ text: '' });
        }, 5000);
    }

    isTicketingSite(url) {
        if (!url) return false;
        const ticketingSites = [
            'interpark.com',
            'tickets.interpark.com',
            'tkglobal.interpark.com', 
            'poticket.interpark.com',
            'ticketlink.co.kr'
        ];
        return ticketingSites.some(site => url.includes(site));
    }

    // 새로운 티켓팅 탭 처리
    handleNewTicketingTab(tab) {
        if (!tab || !tab.id) return;

        console.log(`🎫 새 티켓팅 탭 처리: ${tab.url}`);
        
        // 모니터링이 활성화되어 있으면 자동으로 모니터링 시작
        if (this.isExtensionEnabled && !this.isMonitoring) {
            this.startMonitoring();
            console.log('새 티켓팅 탭으로 인한 모니터링 자동 시작');
        }

        // 탭에 확장 프로그램 상태 전송
        setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'EXTENSION_STATUS',
                data: { 
                    isEnabled: this.isExtensionEnabled,
                    isMonitoring: this.isMonitoring 
                }
            }).catch(() => {
                console.log('새 탭에 메시지 전송 실패 (아직 로드되지 않음)');
            });
        }, 2000);

        // 배지 업데이트
        if (this.isTicketingBookingUrl(tab.url)) {
            chrome.action.setBadgeText({ text: '🎯' });
            chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
            console.log('🎯 예매 페이지 접근 감지');
        }
    }

    // WebNavigation 완료 처리
    handleWebNavigationCompleted(details) {
        console.log(`🌐 WebNavigation 완료: ${details.url}`);
        
        // 예매 관련 페이지인지 확인
        if (this.isTicketingBookingUrl(details.url)) {
            console.log('🎫 예매 페이지 WebNavigation 감지');
            chrome.action.setBadgeText({ text: '📝' });
            chrome.action.setBadgeBackgroundColor({ color: '#FF9800' });
        }
    }

    // 예매/결제 관련 URL 확인
    isTicketingBookingUrl(url) {
        if (!url) return false;
        const bookingPatterns = [
            'BookMain.asp',
            '/ticket/',
            '/booking/',
            '/reserve/',
            '/seat/',
            '/payment/',
            'poticket.interpark.com'
        ];
        return bookingPatterns.some(pattern => url.includes(pattern));
    }

    getSiteFromUrl(url) {
        if (url.includes('interpark.com')) return 'interpark';
        else if (url.includes('ticketlink.co.kr')) return 'ticketlink';
        return 'unknown';
    }

    async notifyAllTicketingTabs(message) {
        try {
            const tabs = await chrome.tabs.query({
                url: ["https://*.interpark.com/*", "https://*.ticketlink.co.kr/*"]
            });

            for (let tab of tabs) {
                chrome.tabs.sendMessage(tab.id, {
                    type: message,
                    data: { isMonitoring: this.isMonitoring }
                }).catch(() => {
                    // 탭이 응답하지 않는 경우 무시
                });
            }
        } catch (error) {
            console.error('탭 알림 오류:', error);
        }
    }
}

// Extension 시작 시 모니터 초기화
const networkMonitor = new NetworkMonitor();

// Extension 설치/업데이트 시 처리
chrome.runtime.onInstalled.addListener(() => {
    console.log('티켓팅 모니터 Extension 설치 완료');
    chrome.action.setBadgeText({ text: '' });
});