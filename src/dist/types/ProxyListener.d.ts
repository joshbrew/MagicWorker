export class EventDispatcher {
    addEventListener(type: any, listener: any): void;
    _listeners: {} | undefined;
    hasEventListener(type: any, listener: any): boolean;
    removeEventListener(type: any, listener: any): void;
    dispatchEvent(event: any): void;
}
export class ElementProxyReceiver extends EventDispatcher {
    style: {};
    get clientWidth(): any;
    get clientHeight(): any;
    setPointerCapture(): void;
    releasePointerCapture(): void;
    getBoundingClientRect(): {
        left: any;
        top: any;
        width: any;
        height: any;
        right: any;
        bottom: any;
    };
    handleEvent(data: any): void;
    left: any;
    top: any;
    width: any;
    height: any;
    focus(): void;
}
export class ProxyManager {
    id: string;
    targets: {};
    handleEvent(data: any): void;
    makeProxy(data: any): void;
    getProxy(id: any): any;
}
