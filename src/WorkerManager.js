
import {CallbackManager} from './lib/workerCallbacks' 

import worker from './magic.worker.js' // internal worker

import { Events } from './lib/Event';
import { initElementProxy } from './lib/ProxyElement';

export class WorkerManager {
    url;
    responses = [];
    workers = [];
    threads = 0;
    threadrot = 0;
    events;
    subEvent;
    unsubEvent;
    addEvent;
    toResolve = {}

    constructor(url, nThreads=0){
        this.url = url;
        this.responses = [];
        this.workers = [];
        this.threads = nThreads;
        this.threadrot = 0;

        this.events = new Events(this);
        this.subEvent = (eventName, result=(_)=>{})=>{this.events.subEvent(eventName,result);}
        this.unsubEvent = (eventName, sub) => {this.events.unsubEvent(eventName,sub)};
        this.addEvent = (eventName, origin, foo, id) => {this.events.addEvent(eventName, origin, foo, id)};

        for(var i = 0; i < nThreads; i++){
          this.addWorker()
        }

    }

    addWorker = (url=this.url, type = 'module') => {


        let newWorker;
        try {
          if (url == null) newWorker = worker()
          else {
            if (!(url instanceof URL)) url = new URL(url, import.meta.url)
            newWorker = new Worker(url, {name:'worker_'+this.workers.length, type})
          }
        } catch (err) {
            console.log("Error, creating dummy worker (WARNING: Single Threaded). ERROR:", err);
            newWorker =  new DummyWorker(this.responses)
        }
        finally {
          if (newWorker){

          let id = "worker_"+Math.floor(Math.random()*10000000000);
            
          this.workers.push({worker:newWorker, id:id});

          newWorker.onmessage = (ev) => {

              var msg = ev.data;

              // Resolve 
              let toResolve = this.toResolve[ev.data.callbackId]
              if (toResolve) {
                toResolve(msg.output)
                delete this.toResolve[ev.data.callbackId]
              }

              // Run Response Callbacks
              this.responses.forEach((foo,_) => {
                if(typeof foo === 'object') foo.callback(msg);
                else if (typeof foo === 'function') foo(msg);
              });
          };

          newWorker.onerror = (e) => {
            console.error(e)
          }

          console.log("magic threads: ", this.workers.length)
          return id; //worker id
        } else return
      }
    }

    addCallback(name='',callback=()=>{}) {
      if(name.length > 0 && !this.responses.find((o)=>{if(typeof o === 'object') {if(o.name === name) return true;} return})) {
        this.responses.push({name:'',callback:callback});
      }
    }

    removeCallback(nameOrIdx='') {
      if(nameOrIdx.length > 0) {
        let idx;
        if(this.responses.find((o,i)=>{if(typeof o === 'object') {if(o.name === nameOrIdx) { idx = i; return true;}}  return})) {
          if (idx) this.responses.splice(idx,1);
        }
      } else if (typeof nameOrIdx === 'number') {
        this.responses.splice(nameOrIdx,1);
      }
    }

    //add a callback to a worker
    addWorkerFunction(functionName,fstring,origin,id) {
      if(functionName && fstring) {
        if(typeof fstring === 'function') fstring = fstring.toString();
        let dict = {foo:'addfunc',args:[functionName,fstring],origin:origin}; //post to the specific worker
        if(!id) this.workers.forEach((w) => {this.post(dict,w.id);}); //post to all of the workers
        else this.post(dict,id);
      }
    }

    //run from the list of callbacks on an available worker
    async run(functionName,args,origin,id,transfer) {
        if(functionName) {
          if(functionName === 'transferClassObject') {
            if(typeof args === 'object' && !Array.isArray(args)) {
              for(const prop in args) {
                if(typeof args[prop] === 'object' && !Array.isArray(args[prop])) args[prop] = args[prop].toString();
              }
            }
          }
          let dict = {foo:functionName, args:args, origin:origin};
          return await this.post(dict,id,transfer);
        }
    }

    runWorkerFunction = this.run

    //a way to set variables on a thread
    setValues(values={},origin,id,transfer) {
      this.run('setValues',values,origin,id,transfer);
    }

    //this creates a message port so particular event outputs can directly message another worker and save overhead on the main thread
    establishMessageChannel(
      eventName,
      worker1Id,
      worker2Id,
      worker2Response, //onEvent=(self,args,origin)=>{} //args will be the output
      foo,
      origin) {
      let channel = new MessageChannel();
      let port1 = channel.port1;
      let port2 = channel.port2;

      this.run(
        'addevent',
        [
          eventName,
          foo,
          port1
        ],
        origin,
        worker1Id,
        [port1]
      );

      this.run(
        'addevent',
        [
          eventName,
          eventName,
          port2
        ],
        origin,
        worker2Id,
        [port2]
      );

      if(typeof worker2Response === 'function')
        this.run(
          'subevent',
          [
            eventName,
            worker2Response.toString()
          ],
          origin,
          worker2Id
        );

    }

    post = (input, id, transfer) => {

      return new Promise(resolve => {
        //console.log('posting',input,id);
        if (Array.isArray(input.input)){
        input.input = input.input.map((v) => {
          if (typeof v === 'function') return v.toString();
          else return v;
        })} 

        input.callbackId = Math.floor(1000000 * Math.random())
        this.toResolve[input.callbackId] = resolve

        if(id == null) {
            const worker = this.workers?.[this.threadrot]?.worker
            this.workers[this.threadrot].worker.postMessage(input,transfer);
            if (worker){
              if(this.threads > 1){
                  this.threadrot++;
                  if(this.threadrot >= this.threads){
                      this.threadrot = 0;
                  }
              }
            }
        }
        else{
            this.workers.find((o)=>{
                if(o.id === id) {
                    o.worker.postMessage(input,transfer); 
                    return true;
                  } else return
            })
        }

      })
    }

    postToWorker = this.post

    terminate(id) {
        let idx;
        let found = this.workers.find((o,i)=>{
            if(o.id === id) {
                idx=i;
                o.worker.terminate();
                return true;
            } else return
        });
        if(found && idx) {
            this.workers.splice(idx,1);
            return true;
        } else return false;
    }

    initElementProxy = initElementProxy
}




//for single threaded applications

class DummyWorker {

  responses
  manager

    constructor(responses) {
        this.responses = responses;

        this.manager = new CallbackManager()

    }

    postMessage=(input)=>{
        let result = this.onmessage({data:input}); 
        this.responses.forEach((foo,_) => {
            foo(result);
        });
    }

    terminate(){}

    onerror = () => {}

    onmessage = (event) => {
      // define gpu instance
      //console.log("worker executing...")
      console.time("worker");
      let output = "function not defined";
    
      this.manager.callbacks.find((o,_)=>{
        if(o.case === event.data.foo) {
          output = o.callback(event.data.input);
          return true;
        } else return
      });

      // output some results!
      console.timeEnd("worker");
    
      return {output: output, foo: event.data.foo, origin: event.data.origin};
    
    }
  }