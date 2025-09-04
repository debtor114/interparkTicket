// 메시지 전송을 위한 유틸리티 클래스
class MessageUtils {
    
    // 재시도 메시지 전송 (최대 3회)
    static safeSendMessageWithRetry(message, callback, retryCount = 0) {
        const maxRetries = 3;
        const retryDelay = 1000; // 1초 대기
        
        MessageUtils.safeSendMessage(message, (response) => {
            // 성공한 경우
            if (response || !chrome.runtime.lastError) {
                if (callback) callback(response);
                return;
            }
            
            // 연결 오류이고 재시도 가능한 경우
            const error = chrome.runtime.lastError?.message || '';
            if ((error.includes('Could not establish connection') || 
                 error.includes('Receiving end does not exist')) && 
                retryCount < maxRetries) {
                
                console.log(`메시지 재시도 ${retryCount + 1}/${maxRetries}...`);
                setTimeout(() => {
                    MessageUtils.safeSendMessageWithRetry(message, callback, retryCount + 1);
                }, retryDelay);
            } else if (callback) {
                callback(null); // 최종 실패
            }
        });
    }
    
    // 안전한 메시지 전송
    static safeSendMessage(message, callback) {
        try {
            // Chrome runtime이 존재하고 연결되어 있는지 확인
            if (!chrome.runtime || !chrome.runtime.sendMessage) {
                console.warn('Chrome runtime이 사용 불가능합니다.');
                return;
            }

            // Extension context가 무효화되었는지 확인
            if (chrome.runtime.id === undefined) {
                console.warn('Extension context가 무효화되었습니다.');
                return;
            }

            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    const error = chrome.runtime.lastError.message;
                    
                    // 일반적인 연결 오류는 경고만 출력
                    if (error.includes('Could not establish connection') || 
                        error.includes('Receiving end does not exist')) {
                        console.warn('백그라운드 스크립트 연결 대기 중...');
                    } else {
                        console.warn('메시지 전송 실패:', error);
                    }
                } else if (callback) {
                    callback(response);
                }
            });
        } catch (error) {
            console.warn('메시지 전송 중 오류:', error);
        }
    }

    // 로그인 상태 변경 알림 (중요 - 재시도)
    static notifyLoginStatusChange(siteData, isLoggedIn, userInfo) {
        MessageUtils.safeSendMessageWithRetry({
            type: 'LOGIN_STATUS_CHANGED',
            data: {
                site: siteData.site,
                isLoggedIn: isLoggedIn,
                userInfo: userInfo,
                url: window.location.href
            }
        });
    }

    // DOM 분석 결과 전송 (중요 - 재시도)
    static sendDOMAnalysisResult(analysisData) {
        MessageUtils.safeSendMessageWithRetry({
            type: 'DOM_ANALYSIS_RESULT',
            data: analysisData
        });
    }

    // 사용자 이벤트 전송 (일반 - 재시도 안함)
    static sendUserEvent(eventData) {
        MessageUtils.safeSendMessage({
            type: 'USER_EVENT_RECORDED',
            data: eventData
        });
    }
}

// 전역 사용을 위해 window 객체에 등록
window.MessageUtils = MessageUtils;