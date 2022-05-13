export function initProxyElement(element: any, workerId: any, origin: any): ProxyElement;
export class ProxyElement {
    constructor(element: any, origin: any, workerId: any, eventHandlers: any, manager: any);
    id: string;
    eventHandlers: any;
    origin: any;
    workerId: any;
    manager: WorkerManager;
}
import { WorkerManager } from "../../WorkerManager";
