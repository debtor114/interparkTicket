// 메인 티켓팅 모니터 클래스 (리팩토링됨)
class TicketingMonitor {
    constructor() {
        this.isLoggedIn = false;
        this.currentSite = SiteDetector.detectSite();
        this.loginCheckInterval = null;
        this.eventRecorder = new EventRecorder();
        
        this.init();
    }

    init() {
        // 인터파크 사이트에서만 동작하도록 제한
        if (!SiteDetector.isInterparkSite()) {
            console.log('인터파크 사이트가 아니므로 확장 프로그램을 비활성화합니다.');
            return;
        }
        
        console.log(`현재 사이트: ${this.currentSite}`);
        this.startLoginCheck();
        this.injectStatusIndicator();
        this.eventRecorder.startRecording();
        this.startPeriodicAnalysis();
    }

    // 로그인 상태 확인 시작
    startLoginCheck() {
        this.checkLoginStatus();
        this.loginCheckInterval = setInterval(() => {
            this.checkLoginStatus();
        }, 3000);
    }

    // 사이트별 로그인 상태 확인
    async checkLoginStatus() {
        let loginInfo = null;
        
        try {
            // 특정 사이트별 로그인 확인
            if (this.currentSite === 'interpark') {
                loginInfo = LoginDetector.checkInterparkLogin();
            } else if (this.currentSite === 'ticketlink') {
                loginInfo = LoginDetector.checkTicketlinkLogin();
            } else if (this.currentSite === 'yes24') {
                loginInfo = LoginDetector.checkYes24Login();
            } else if (this.currentSite === 'melon') {
                loginInfo = LoginDetector.checkMelonLogin();
            } else {
                loginInfo = LoginDetector.checkUniversalLogin();
            }

            console.log(`[LoginCheck] Site: ${this.currentSite}, Detected LoginInfo:`, loginInfo);

            const wasLoggedIn = this.isLoggedIn;
            this.isLoggedIn = loginInfo.isLoggedIn;

            // 로그인 상태 변화 시 background script에 알림
            if (wasLoggedIn !== this.isLoggedIn) {
                MessageUtils.notifyLoginStatusChange(
                    { site: this.currentSite },
                    this.isLoggedIn,
                    loginInfo
                );

                this.updateStatusIndicator();
                console.log(`[LoginCheck] 로그인 상태 변경: ${this.isLoggedIn ? '로그인' : '로그아웃'}`);
            }

        } catch (error) {
            console.error('[LoginCheck] 로그인 상태 확인 오류:', error);
        }
    }

    // 상태 표시기 주입 (CSP 호환)
    injectStatusIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'ticketing-monitor-indicator';
        
        // 내부 div 생성
        const innerDiv = document.createElement('div');
        
        // 스타일 직접 적용 (인라인 스타일 대신)
        Object.assign(innerDiv.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: '9999',
            background: '#333',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            cursor: 'pointer'
        });
        
        // 텍스트 내용 추가
        const statusSpan = document.createElement('span');
        statusSpan.id = 'login-status';
        statusSpan.textContent = '확인 중...';
        
        innerDiv.appendChild(document.createTextNode('🎫 모니터: '));
        innerDiv.appendChild(statusSpan);
        indicator.appendChild(innerDiv);
        
        document.body.appendChild(indicator);
        
        // 이벤트 리스너 추가
        indicator.addEventListener('click', () => {
            this.showDetailedStatus();
        });
    }

    // 상태 표시기 업데이트
    updateStatusIndicator() {
        const statusElement = document.getElementById('login-status');
        console.log('[StatusIndicator] Updating status indicator. Element found:', !!statusElement);
        if (statusElement) {
            statusElement.textContent = this.isLoggedIn ? '로그인됨' : '로그인 필요';
            statusElement.style.color = this.isLoggedIn ? '#4CAF50' : '#FFC107';
            console.log(`[StatusIndicator] Set text to: ${statusElement.textContent}, color: ${statusElement.style.color}`);
        }
    }

    // 상세 상태 표시
    showDetailedStatus() {
        const status = this.isLoggedIn ? '로그인됨' : '로그인되지 않음';
        alert(`티켓팅 모니터 상태\n\n사이트: ${this.currentSite}\n로그인: ${status}\nURL: ${window.location.href}`);
    }

    // DOM 요소 분석 기능 (경량화)
    analyzeTicketingElements() {
        console.log('🔍 티켓팅 요소 분석 시작...');
        
        // 간단한 분석 결과만 저장
        const analysis = {
            site: this.currentSite,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            summary: {
                reservationButtonCount: document.querySelectorAll('a[href*="/ticket"], .btn').length,
                loginElements: document.querySelectorAll('a[href*="login"], [class*="login"]').length,
                formCount: document.querySelectorAll('form').length,
                buttonCount: document.querySelectorAll('button, [role="button"]').length
            }
        };

        // 콘솔에만 상세 분석 출력 (저장 안함)
        this.logDetailedAnalysis();

        // 경량 분석 결과만 전송
        MessageUtils.sendDOMAnalysisResult(analysis);

        console.log('✅ 티켓팅 요소 분석 완료 (경량):', analysis);
        return analysis;
    }

    // 상세 분석을 콘솔에만 출력
    logDetailedAnalysis() {
        console.group('🎫 인터파크 티켓 사이트 상세 분석');
        
        // 예매 관련 링크
        const ticketLinks = document.querySelectorAll('a[href*="/ticket"], a[href*="/goods/"]');
        console.log('🎟️ 예매 링크:', Array.from(ticketLinks).slice(0, 5).map(el => ({
            text: el.textContent?.trim(),
            href: el.href
        })));

        // 로그인 관련
        const loginElements = document.querySelectorAll('a[href*="login"], [class*="login"]');
        console.log('🔐 로그인 요소:', Array.from(loginElements).map(el => el.textContent?.trim()));

        // 검색 관련
        const searchElements = document.querySelectorAll('input[type="search"], [class*="search"]');
        console.log('🔍 검색 요소:', searchElements.length, '개');

        // 버튼들
        const buttons = document.querySelectorAll('button, [role="button"]');
        console.log('🔘 버튼 요소:', buttons.length, '개');
        
        console.groupEnd();
    }

    // 주기적으로 DOM 분석 실행
    startPeriodicAnalysis() {
        setTimeout(() => {
            this.analyzeTicketingElements();
        }, 3000);

        setInterval(() => {
            this.analyzeTicketingElements();
        }, 30000);
    }

    // 정리 함수
    destroy() {
        if (this.loginCheckInterval) {
            clearInterval(this.loginCheckInterval);
            this.loginCheckInterval = null;
        }
        this.eventRecorder.stopRecording();

        const indicator = document.getElementById('ticketing-monitor-indicator');
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
        console.log('🎫 티켓팅 모니터: 상태 표시기 제거됨.');
    }
}

// 백그라운드 스크립트 연결 확인
function checkBackgroundConnection() {
    return new Promise((resolve) => {
        if (!chrome.runtime || chrome.runtime.id === undefined) {
            resolve(false);
            return;
        }
        
        chrome.runtime.sendMessage({type: 'PING'}, (response) => {
            resolve(!chrome.runtime.lastError);
        });
    });
}

// 백그라운드 스크립트 로드 대기
async function waitForBackground(maxWaitTime = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
        const isConnected = await checkBackgroundConnection();
        if (isConnected) {
            console.log('✅ 백그라운드 스크립트 연결 확인됨');
            return true;
        }
        
        console.log('⏳ 백그라운드 스크립트 로드 대기 중...');
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.warn('⚠️ 백그라운드 스크립트 연결 타임아웃');
    return false;
}

// 초기화 함수
async function initializeMonitor() {
    try {
        const result = await chrome.storage.local.get(['isExtensionEnabled']);
        const isExtensionEnabled = result.isExtensionEnabled !== false;

        if (isExtensionEnabled) {
            // 백그라운드 스크립트 연결 대기
            await waitForBackground();
            
            window.ticketingMonitor = new TicketingMonitor();
        } else {
            console.log('🎫 티켓팅 모니터: 확장 프로그램이 비활성화되어 있습니다.');
        }
    } catch (error) {
        console.error('티켓팅 모니터 초기화 오류:', error);
    }
}

// DOM 로드 완료 후 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMonitor);
} else {
    initializeMonitor();
}

// 백그라운드 스크립트로부터 메시지 수신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_EXTENSION') {
        if (message.isEnabled) {
            if (!window.ticketingMonitor) {
                console.log('🎫 티켓팅 모니터: 활성화 메시지 수신, 모니터 시작.');
                window.ticketingMonitor = new TicketingMonitor();
            }
        } else {
            if (window.ticketingMonitor) {
                console.log('🎫 티켓팅 모니터: 비활성화 메시지 수신, 모니터 중지.');
                window.ticketingMonitor.destroy();
                window.ticketingMonitor = null;
            }
        }
    } else if (message.type === 'EXTENSION_STATUS') {
        // 새 탭에서 확장 프로그램 상태 수신
        console.log('🎫 확장 프로그램 상태 수신:', message.data);
        if (message.data.isEnabled && !window.ticketingMonitor) {
            console.log('🎫 새 탭에서 모니터링 자동 시작');
            window.ticketingMonitor = new TicketingMonitor();
        }
        sendResponse({ success: true });
    } else if (message.type === 'EXPORT_ANALYSIS') {
        // 현재 페이지 분석 결과 내보내기
        try {
            const analysis = ExportUtils.exportCurrentPageAnalysis();
            console.log('📊 페이지 분석 및 내보내기 완료:', analysis);
            sendResponse({ success: true, analysis: analysis });
        } catch (error) {
            console.error('분석 내보내기 오류:', error);
            sendResponse({ success: false, error: error.message });
        }
    } else if (message.type === 'GET_LOGIN_STATUS') {
        // 로그인 상태 반환
        if (window.ticketingMonitor) {
            sendResponse({
                isLoggedIn: window.ticketingMonitor.isLoggedIn,
                site: window.ticketingMonitor.currentSite
            });
        } else {
            sendResponse({ isLoggedIn: false, site: 'unknown' });
        }
    }
    
    return true; // 비동기 응답 지원
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (window.ticketingMonitor) {
        window.ticketingMonitor.destroy();
    }
});