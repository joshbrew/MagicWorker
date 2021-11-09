## MagicWorker

`npm i magicworker`

It's gonna take a while to fully document this thing


Example:
```
//There is a lot of out of context code here, it's ripped from the multithreaded applet in Brains@Play, for context. 
// We'll add a standalone example here soon with proper context/demonstration for all of this.

        //add the worker manager if it's not on window
        window.workers = new WorkerManager();
        this.origin = this.props.id;

        //add workers
        this.worker1Id      = window.workers.addWorker(); // Thread 1
        this.worker2Id      = window.workers.addWorker(); // Thread 2
        this.canvasWorkerId = window.workers.addWorker(); // Thread 3 - render thread
        
        this.canvas.width = this.AppletHTML.node.clientWidth;
        this.canvas.height = this.AppletHTML.node.clientHeight;
        
        //quick setup canvas worker with initial settings
        this.canvasWorker = new ThreadedCanvas(
            this.origin,                                              //name given for the worker origin tag 
            this.canvas,                                              //canvas element to transfer to offscreencanvas
            undefined,                                                //canvas context setting
            undefined,//this.draw,                                    //pass the custom draw function
            undefined,//{angle:0,angleChange:0.000,bgColor:'black',cColor:'red'}, //'this' values, canvas and context/ctx are also available under 'self' for now, these can be mutated like uniforms with the 'setValues' command
            this.canvasWorkerId                                       //optional worker id to use, otherwise it sets up its own worker
        );    // This also makes a worker if no workerId is supplied


        //create a proxy for the canvas on the worker thread to mirror key inputs 
        let proxy = initElementProxy(
            this.canvas,
            this.canvasWorkerId,
            this.origin
        );
        
        //add some events to listen to thread results
        window.workers.addEvent('thread1process',this.origin,'add',this.worker1Id);
        window.workers.addEvent('thread2process',this.origin,'mul',this.worker2Id);
        window.workers.addEvent('render',this.origin,'render',this.canvasWorkerId);
        //window.workers.addEvent('particle1Step',this.origin,'particleStep',this.worker1Id);
        //window.workers.addEvent('particle1Setup',this.origin,'particleSetup',this.worker1Id);

        //add some custom functions to the threads
        window.workers.addWorkerFunction( 
            'add',
            function add(self,args,origin){return args[0]+args[1];}.toString(),
            this.origin,
            this.worker1Id
        );

        window.workers.addWorkerFunction(
            'mul',
            function mul(self,args,origin){return args[0]*args[1];}.toString(),
            this.origin,
            this.worker2Id
        );
        
        //list all functions on a thread
        window.workers.runWorkerFunction('list',undefined,this.origin,this.worker1Id);
        
        //add a particle system
        window.workers.runWorkerFunction('transferClassObject',{particleClass:DynamicParticles.toString()},this.origin,this.worker1Id);



        //thread 1 process initiated by button press
        window.workers.subEvent('thread1process',(res) => { //send thread1 result to thread 2
            if(typeof res.output === 'number')
            {
                this.increment = res.output;
                window.workers.runWorkerFunction('mul',[this.increment,2],this.origin,this.worker2Id);
                console.log('multiply by 2 on thread 2')
            } else if (Array.isArray(res.output) && Array.isArray(res.output[0])) {
                //console.log('thread1 event',res.output,Date.now());
                console.log(res)

            }
        });

        let element = document.getElementById(this.props.id+'res');
        //send thread2 result to canvas thread to update visual settings
        window.workers.subEvent('thread2process',(res) => { 
            //console.log('thread2 event',res,Date.now());
            console.log('thread2 event',res);
            if(typeof res.output === 'number')
            {
                window.workers.runWorkerFunction('setValues',{angleChange:res.output},this.origin,this.canvasWorkerId);
                element.innerHTML = res.output.toFixed(3);
                this.pushedUpdateToThreads = false;
                console.log('set new angle change speed on render thread (3)')
            }
        });

        //on input event send to thread 1
        document.getElementById(this.props.id+'input').onclick = () => {
            //console.log('clicked', this.pushedUpdateToThreads); 
            if(this.pushedUpdateToThreads === false) {
                window.workers.runWorkerFunction('add',[this.increment,0.001],this.origin,this.worker1Id);
                console.log('add 0.001 on thread 1')
                this.pushedUpdateToThreads = true;
            }
        };

        //Message Channels
        // //direct communication channel between particle and render threads
        // window.workers.establishMessageChannel(
        //     'particleStep',
        //     this.worker1Id,
        //     this.canvasWorkerId,
        //     function worker2Response(self,args,origin,port,eventName){
        //         //args = [float32array] from particle1Step output
        //         self.boids = args.output;
        //         if(port) 
        //         requestAnimationFrame( //let the particle thread know that the render thread is ready for more data (throttled by framerate)
        //             ()=>{
        //                 port.postMessage({foo:'particleStep',input:[performance.now()*0.001],origin:origin});
        //             }
        //         ); 
        //     },
        //     'particleStep',
        //     this.origin
        // );

```