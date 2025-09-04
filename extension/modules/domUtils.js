// DOM 요소 분석을 위한 유틸리티 함수들
class DOMUtils {
    // 안전한 클래스명 추출
    static safeGetClassName(element) {
        try {
            if (!element) return '';
            const className = element.className;
            if (typeof className === 'string') {
                return className.toLowerCase();
            } else if (className && typeof className.toString === 'function') {
                return className.toString().toLowerCase();
            }
            return '';
        } catch (error) {
            console.warn('클래스명 추출 오류:', error);
            return '';
        }
    }

    // 안전한 텍스트 추출
    static safeGetText(element) {
        try {
            if (!element) return '';
            const text = element.textContent || element.innerText || '';
            return text.trim().toLowerCase();
        } catch (error) {
            console.warn('텍스트 추출 오류:', error);
            return '';
        }
    }

    // 안전한 값 추출
    static safeGetValue(element) {
        try {
            if (!element) return '';
            const value = element.value || '';
            return value.toString().toLowerCase();
        } catch (error) {
            console.warn('값 추출 오류:', error);
            return '';
        }
    }

    // XPath 생성
    static getXPath(element) {
        if (element.id) {
            return `//*[@id="${element.id}"]`;
        }
        
        let path = '';
        while (element && element.nodeType === Node.ELEMENT_NODE) {
            let index = 0;
            let hasFollowingSiblings = false;
            let hasPrecedingSiblings = false;
            
            for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
                    hasPrecedingSiblings = true;
                    index++;
                }
            }
            
            for (let sibling = element.nextSibling; sibling && !hasFollowingSiblings; sibling = sibling.nextSibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
                    hasFollowingSiblings = true;
                }
            }
            
            const tagName = element.nodeName.toLowerCase();
            const pathIndex = (hasPrecedingSiblings || hasFollowingSiblings) ? `[${index + 1}]` : '';
            path = `/${tagName}${pathIndex}${path}`;
            
            element = element.parentNode;
        }
        
        return path;
    }

    // 요소의 가시성 확인
    static isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        
        return rect.width > 0 && 
               rect.height > 0 && 
               style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0';
    }

    // 요소 정보를 추출하는 헬퍼 함수
    static getElementInfo(element, type) {
        return {
            type: type,
            tag: element.tagName,
            id: element.id,
            className: DOMUtils.safeGetClassName(element),
            text: DOMUtils.safeGetText(element).substring(0, 100),
            value: DOMUtils.safeGetValue(element),
            name: element.name || '',
            href: element.href || '',
            onclick: !!element.onclick,
            xpath: DOMUtils.getXPath(element),
            rect: element.getBoundingClientRect(),
            visible: DOMUtils.isElementVisible(element),
            styles: {
                display: getComputedStyle(element).display,
                visibility: getComputedStyle(element).visibility,
                cursor: getComputedStyle(element).cursor
            }
        };
    }
}

// 전역 사용을 위해 window 객체에 등록
window.DOMUtils = DOMUtils;