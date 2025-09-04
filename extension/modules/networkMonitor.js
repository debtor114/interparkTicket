// 네트워크 요청 모니터링 클래스
class NetworkRequestMonitor {
    constructor() {
        this.ticketingRequests = [];
        this.isMonitoring = false;
    }

    // 모니터링 시작
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.ticketingRequests = [];
        console.log('🎯 네트워크 모니터링 시작됨');
    }

    // 모니터링 중지
    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        console.log('🛑 네트워크 모니터링 중지됨');
    }

    // 요청 처리
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

    // 헤더 처리
    handleHeaders(details) {
        if (!this.isTicketingRelated(details.url) && !this.isResourceToCapture(details.url, details.type)) return;

        const request = this.ticketingRequests.find(r => r.id === details.requestId);
        if (request) {
            request.headers = details.requestHeaders;
        }
    }

    // 응답 처리
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

    // 티켓팅 관련 요청인지 확인
    isTicketingRelated(url) {
        const ticketingPatterns = [
            '/ticket', '/booking', '/reserve', '/purchase', '/payment',
            '/order', '/seat', '/queue', '/api/v1', '/api/v2', 'ajax', 'json'
        ];

        return ticketingPatterns.some(pattern => 
            url.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    // 중요한 티켓팅 요청인지 확인
    isImportantTicketingRequest(url) {
        const importantPatterns = ['booking', 'reserve', 'purchase', 'payment', 'seat', 'queue'];
        return importantPatterns.some(pattern => 
            url.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    // 캡처할 리소스인지 확인
    isResourceToCapture(url, resourceType) {
        const captureTypes = ['stylesheet', 'script', 'main_frame', 'sub_frame'];
        const captureExtensions = ['.css', '.js', '.html', '.htm'];
        
        return captureTypes.includes(resourceType) || 
               captureExtensions.some(ext => url.toLowerCase().includes(ext));
    }

    // 요청 유형 분류
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

    // URL에서 사이트 추출
    getSiteFromUrl(url) {
        if (url.includes('interpark.com')) return 'interpark';
        else if (url.includes('ticketlink.co.kr')) return 'ticketlink';
        return 'unknown';
    }

    // 중요 요청 알림
    notifyImportantRequest(request) {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
        console.log('🚨 중요 티켓팅 요청 감지:', request);
    }

    // 요청 목록 반환
    getRequests() {
        return this.ticketingRequests;
    }

    // 통계 생성
    generateStats() {
        const stats = {
            totalRequests: this.ticketingRequests.length,
            byType: {},
            bySite: {},
            byStatus: {},
            timeline: []
        };

        this.ticketingRequests.forEach(req => {
            stats.byType[req.type] = (stats.byType[req.type] || 0) + 1;
            stats.bySite[req.site] = (stats.bySite[req.site] || 0) + 1;
            
            if (req.statusCode) {
                const status = Math.floor(req.statusCode / 100) + 'xx';
                stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
            }

            stats.timeline.push({
                timestamp: req.timestamp,
                type: req.type,
                url: req.url
            });
        });

        return stats;
    }
}

// 전역 사용을 위해 window 객체에 등록
window.NetworkRequestMonitor = NetworkRequestMonitor;