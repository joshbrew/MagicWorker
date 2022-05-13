export class ThreadedCanvas {
    constructor(manager: any, canvas: any, context?: undefined, drawFunction?: undefined, setValues?: undefined, workerId?: undefined, origin?: string, transfer?: undefined);
    origin: string;
    workerId: any;
    manager: any;
    canvas: any;
    context: any;
    setContext(context?: any): void;
    setCanvas(canvas?: any): void;
    offscreen: any;
    setValues(valObject?: undefined, transfer?: undefined): void;
    setValues(values?: {}, transfer?: any[]): void;
    setAnimation(animationFunction: any): false | undefined;
    addSetup(setupFunction: any): void;
    setThreeAnimation(setupFunction: any, drawFunction: any): void;
    startThreeAnimation(): void;
    clearThreeAnimation(): void;
    startAnimation(): void;
    stopAnimation(): void;
    setCanvasSize(w?: any, h?: any): void;
    initWorker(): void;
    init(drawFunction: any): void;
    deinit(): void;
    workeronmessage: (msg: any) => void;
    test(id?: string): void;
}
