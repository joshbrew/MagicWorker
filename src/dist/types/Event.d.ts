export class Events {
    constructor(manager?: undefined);
    state: any;
    manager: any;
    subEvent(eventName: any, response?: (output: any) => void): any;
    unsubEvent(eventName: any, sub: any): any;
    addEvent(eventName: any, workerId?: undefined, functionName?: undefined, origin?: undefined): Promise<any>;
    removeEmitter(eventName: any): void;
    emit: (eventName: any, input: any, workerId?: undefined, transfer?: undefined, port?: undefined) => void;
    callback: (msg: any) => void;
    export: () => Events;
}
