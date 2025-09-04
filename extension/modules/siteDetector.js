// 사이트 감지 및 분류 클래스
class SiteDetector {
    
    // 현재 사이트 감지 (범용)
    static detectSite() {
        const hostname = window.location.hostname;
        const url = window.location.href;
        const title = document.title;
        
        // 알려진 티켓팅 사이트들
        const knownSites = [
            { name: 'interpark', domains: ['interpark.com'] },
            { name: 'ticketlink', domains: ['ticketlink.co.kr'] },
            { name: 'yes24', domains: ['yes24.com'] },
            { name: 'melon', domains: ['melon.com'] },
            { name: 'auction', domains: ['auction.co.kr'] },
            { name: 'gmarket', domains: ['gmarket.co.kr'] },
            { name: 'kyobobook', domains: ['kyobobook.co.kr'] },
            { name: 'aladin', domains: ['aladin.co.kr'] }
        ];

        // 알려진 사이트 확인
        for (let site of knownSites) {
            if (site.domains.some(domain => hostname.includes(domain))) {
                return site.name;
            }
        }

        // 티켓팅 사이트 휴리스틱 감지
        if (SiteDetector.isLikelyTicketingSite()) {
            return `detected_${hostname.replace(/\./g, '_')}`;
        }

        return 'unknown';
    }

    // 티켓팅 사이트 가능성 확인
    static isLikelyTicketingSite() {
        const indicators = [
            // URL 기반
            window.location.href.toLowerCase().includes('ticket'),
            window.location.href.toLowerCase().includes('booking'),
            window.location.href.toLowerCase().includes('reserve'),
            
            // 제목 기반
            document.title.toLowerCase().includes('티켓'),
            document.title.toLowerCase().includes('ticket'),
            document.title.toLowerCase().includes('예매'),
            
            // DOM 기반
            document.querySelector('.seat, [class*="seat"]') !== null,
            document.querySelector('.ticket, .booking') !== null,
            document.querySelector('[href*="ticket"], [href*="booking"]') !== null,
            
            // 텍스트 기반
            document.body.textContent.includes('좌석선택'),
            document.body.textContent.includes('예매하기'),
            document.body.textContent.includes('티켓구매')
        ];

        const score = indicators.filter(Boolean).length;
        return score >= 3; // 3개 이상 조건을 만족하면 티켓팅 사이트로 판단
    }

    // 인터파크 사이트 확인
    static isInterparkSite() {
        const hostname = window.location.hostname.toLowerCase();
        const interparkDomains = [
            'interpark.com',
            'ticket.interpark.com',
            'book.interpark.com',
            'tour.interpark.com'
        ];
        
        return interparkDomains.some(domain => hostname.includes(domain));
    }

    // 티켓팅 사이트인지 확인 (범용)
    static isTicketingSite(url = window.location.href) {
        if (!url) return false;
        return url.includes('interpark.com') || 
               url.includes('ticketlink.co.kr') ||
               url.includes('yes24.com') ||
               url.includes('melon.com');
    }
}

// 전역 사용을 위해 window 객체에 등록
window.SiteDetector = SiteDetector;