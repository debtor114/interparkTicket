// DOM 이벤트 및 사용자 상호작용 녹화 클래스
class EventRecorder {
    constructor() {
        this.isRecording = false;
        this.events = [];
        this.lastEventTime = Date.now();
        this.eventHandlers = {};
        this.sessionId = null;
        this.mutationObserver = null;
        
        this.setupEventHandlers();
    }

    // 이벤트 핸들러 설정
    setupEventHandlers() {
        // 클릭 이벤트
        this.eventHandlers.click = (event) => {
            this.recordEvent('click', {
                elementType: event.target.tagName,
                elementId: event.target.id,
                elementClass: DOMUtils ? DOMUtils.safeGetClassName(event.target) : (event.target.className || ''),
                elementText: event.target.textContent?.slice(0, 100),
                xpath: DOMUtils ? DOMUtils.getXPath(event.target) : '',
                coordinates: { x: event.clientX, y: event.clientY },
                button: event.button,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey
            });
        };

        // 입력 이벤트
        this.eventHandlers.input = (event) => {
            const isPasswordField = event.target.type === 'password';
            this.recordEvent('input', {
                elementType: event.target.tagName,
                elementId: event.target.id,
                elementName: event.target.name,
                elementClass: DOMUtils ? DOMUtils.safeGetClassName(event.target) : (event.target.className || ''),
                inputType: event.target.type,
                value: isPasswordField ? '[PASSWORD]' : event.target.value?.slice(0, 100),
                xpath: DOMUtils ? DOMUtils.getXPath(event.target) : ''
            });
        };

        // 키보드 이벤트
        this.eventHandlers.keydown = (event) => {
            if (event.key === 'Enter' || event.key === 'Tab' || event.key === 'Escape' || 
                event.ctrlKey || event.altKey || event.metaKey) {
                this.recordEvent('keydown', {
                    key: event.key,
                    code: event.code,
                    ctrlKey: event.ctrlKey,
                    shiftKey: event.shiftKey,
                    altKey: event.altKey,
                    metaKey: event.metaKey,
                    elementType: event.target.tagName,
                    elementId: event.target.id,
                    xpath: DOMUtils ? DOMUtils.getXPath(event.target) : ''
                });
            }
        };

        // 폼 제출 이벤트
        this.eventHandlers.submit = (event) => {
            const formData = new FormData(event.target);
            const formFields = {};
            
            for (let [key, value] of formData.entries()) {
                if (key.toLowerCase().includes('password') || 
                    key.toLowerCase().includes('pass') ||
                    key.toLowerCase().includes('secret')) {
                    formFields[key] = '[MASKED]';
                } else {
                    formFields[key] = value?.toString().slice(0, 100);
                }
            }

            this.recordEvent('submit', {
                elementType: event.target.tagName,
                elementId: event.target.id,
                elementClass: DOMUtils ? DOMUtils.safeGetClassName(event.target) : (event.target.className || ''),
                action: event.target.action,
                method: event.target.method,
                formFields: formFields,
                xpath: DOMUtils ? DOMUtils.getXPath(event.target) : ''
            });
        };

        // 페이지 변화 이벤트
        this.eventHandlers.beforeunload = (event) => {
            this.recordEvent('beforeunload', {
                url: window.location.href,
                title: document.title
            });
        };

        // 마우스 움직임 (throttled)
        let mouseMoveThrottle = null;
        this.eventHandlers.mousemove = (event) => {
            if (mouseMoveThrottle) clearTimeout(mouseMoveThrottle);
            mouseMoveThrottle = setTimeout(() => {
                this.recordEvent('mousemove', {
                    coordinates: { x: event.clientX, y: event.clientY },
                    elementType: event.target.tagName,
                    elementId: event.target.id,
                    elementClass: DOMUtils ? DOMUtils.safeGetClassName(event.target) : (event.target.className || '')
                }, false);
            }, 500);
        };

        // 스크롤 이벤트 (throttled)
        let scrollThrottle = null;
        this.eventHandlers.scroll = (event) => {
            if (scrollThrottle) clearTimeout(scrollThrottle);
            scrollThrottle = setTimeout(() => {
                this.recordEvent('scroll', {
                    scrollX: window.scrollX,
                    scrollY: window.scrollY,
                    elementType: event.target.tagName || 'window'
                }, false);
            }, 200);
        };

        // 페이지 로드 완료
        this.eventHandlers.load = (event) => {
            this.recordEvent('load', {
                url: window.location.href,
                title: document.title,
                loadTime: Date.now() - performance.navigationStart
            });
        };

        // DOM 변화 감지 설정
        this.setupDOMObserver();
    }

    // DOM 변화 관찰자 설정
    setupDOMObserver() {
        if (typeof MutationObserver !== 'undefined') {
            this.mutationObserver = new MutationObserver((mutations) => {
                const importantMutations = mutations.filter(mutation => {
                    return mutation.type === 'childList' && 
                           (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) &&
                           this.isImportantElement(mutation.target);
                });

                if (importantMutations.length > 0) {
                    this.recordEvent('dom_mutation', {
                        mutationCount: importantMutations.length,
                        addedNodes: importantMutations.reduce((acc, m) => acc + m.addedNodes.length, 0),
                        removedNodes: importantMutations.reduce((acc, m) => acc + m.removedNodes.length, 0),
                        targetElements: importantMutations.map(m => ({
                            tagName: m.target.tagName,
                            id: m.target.id,
                            className: DOMUtils ? DOMUtils.safeGetClassName(m.target) : (m.target.className || '')
                        }))
                    }, false);
                }
            });
        }
    }

    // 중요한 엘리먼트 판단
    isImportantElement(element) {
        const importantTags = ['FORM', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
        const importantClasses = ['ticket', 'seat', 'booking', 'payment', 'login', 'btn', 'button'];
        const importantIds = ['login', 'booking', 'payment', 'seat', 'ticket'];
        
        return importantTags.includes(element.tagName) ||
               importantClasses.some(cls => element.className?.toLowerCase().includes(cls)) ||
               importantIds.some(id => element.id?.toLowerCase().includes(id));
    }

    // 이벤트 기록
    recordEvent(eventType, eventData, isImportant = true) {
        if (!this.isRecording) return;

        const now = Date.now();
        const event = {
            type: eventType,
            timestamp: now,
            timeSinceLastEvent: now - this.lastEventTime,
            url: window.location.href,
            title: document.title,
            data: eventData,
            isImportant: isImportant,
            sessionId: this.getSessionId()
        };

        this.events.push(event);
        this.lastEventTime = now;

        // 중요한 이벤트는 즉시 background script에 전송
        if (isImportant && MessageUtils) {
            MessageUtils.sendUserEvent(event);
        }

        // 이벤트 로그 관리 (최대 1000개)
        if (this.events.length > 1000) {
            this.events = this.events.slice(-500);
        }

        console.log(`📹 ${eventType} 이벤트 기록:`, eventData);
    }

    // 세션 ID 생성/관리
    getSessionId() {
        if (!this.sessionId) {
            this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        return this.sessionId;
    }

    // 녹화 시작
    startRecording() {
        if (this.isRecording) return;
        
        this.isRecording = true;
        this.events = [];
        this.lastEventTime = Date.now();
        
        // 모든 이벤트 리스너 등록
        Object.entries(this.eventHandlers).forEach(([eventType, handler]) => {
            document.addEventListener(eventType, handler, true);
        });

        // DOM 관찰자 시작
        if (this.mutationObserver) {
            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'id', 'style', 'disabled', 'value']
            });
        }

        console.log('📹 사용자 상호작용 녹화 시작');
        this.recordEvent('recording_started', { 
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        });
    }

    // 녹화 중지
    stopRecording() {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        
        // 모든 이벤트 리스너 해제
        Object.entries(this.eventHandlers).forEach(([eventType, handler]) => {
            document.removeEventListener(eventType, handler, true);
        });

        // DOM 관찰자 중지
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }

        console.log('📹 사용자 상호작용 녹화 중지');
        this.recordEvent('recording_stopped', {
            totalEvents: this.events.length,
            recordingDuration: Date.now() - (this.events[0]?.timestamp || Date.now())
        });
    }

    // 녹화된 이벤트 내보내기
    exportEvents() {
        return {
            sessionId: this.sessionId,
            events: this.events,
            metadata: {
                site: window.location.hostname,
                totalEvents: this.events.length,
                recordingStart: this.events[0]?.timestamp,
                recordingEnd: this.events[this.events.length - 1]?.timestamp,
                userAgent: navigator.userAgent
            }
        };
    }
}

// 전역 사용을 위해 window 객체에 등록
window.EventRecorder = EventRecorder;