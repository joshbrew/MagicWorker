export class workerGPU {
    constructor(callbackManager: any);
    gpu: any;
    callbackManager: any;
    callbacks: {
        case: string;
        callback: (self: any, args: any, origin: any) => any;
    }[] | undefined;
    addCallbacks(callbacks?: {
        case: string;
        callback: (self: any, args: any, origin: any) => any;
    }[] | undefined): void;
}
