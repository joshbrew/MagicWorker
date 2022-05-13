export class workerRenderer {
    constructor(callbackManager: any);
    callbackManager: any;
    callbacks: ({
        case: string;
        callback: (self: any, args: any, origin: any) => boolean;
    } | {
        case: string;
        callback: (self: any, args: any, origin: any) => Promise<boolean>;
    } | {
        case: string;
        callback: (self: any, args: any, origin: any) => number;
    })[];
    addCallbacks(callbacks?: ({
        case: string;
        callback: (self: any, args: any, origin: any) => boolean;
    } | {
        case: string;
        callback: (self: any, args: any, origin: any) => Promise<boolean>;
    } | {
        case: string;
        callback: (self: any, args: any, origin: any) => number;
    })[]): void;
}
