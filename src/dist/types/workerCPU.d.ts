export class workerCPU {
    constructor(callbackManager: any);
    callbackManager: any;
    callbacks: {
        case: string;
        callback: (self: any, args: any, origin: any) => any;
    }[];
    addCallbacks(callbacks?: {
        case: string;
        callback: (self: any, args: any, origin: any) => any;
    }[]): void;
}
