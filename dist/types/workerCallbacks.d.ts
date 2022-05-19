export class CallbackManager {
    constructor(options?: {
        cpu: boolean;
        gpu: boolean;
        renderer: boolean;
    });
    canvas: any;
    ctx: any;
    context: any;
    EVENTS: Events;
    EVENTSETTINGS: any[];
    ID: number;
    defaultFunctions: {
        case: string;
        callback: (self: any, args: any, origin: any) => void;
    }[];
    callbacks: any;
    workerCPU: workerCPU | undefined;
    workerGPU: workerGPU | undefined;
    workerRenderer: workerRenderer | undefined;
    addCallback: (functionName: any, callback?: (self: any, args: any, origin: any) => void) => boolean;
    removeCallback: (functionName: any) => boolean;
    runCallback: (functionName: any, args: any[] | undefined, origin: any) => Promise<any>;
    checkEvents: (functionName: any, origin: any) => any;
    checkCallbacks: (event: any) => Promise<any>;
}
import { Events } from "../../lib/utils/Event.js";
import { workerCPU } from "../../lib/workerCPU/workerCPU.js";
import { workerGPU } from "../../lib/workerGPU/workerGPU.js";
import { workerRenderer } from "../../lib/workerRenderer/workerRenderer";
