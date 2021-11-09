import { WorkerManager } from "../WorkerManager"

//The animation should probably be an arrow function
export class ThreadedCanvas {
    constructor(name= `canvas_${Math.round(Math.random()*100000)}`,canvas, context=undefined, animation=undefined, setValues=undefined, workerId=undefined, transfer=undefined) { 
        if(!canvas) throw new Error('Input a canvas element or Id')
        this.name = name;
        this.workerId = workerId;
        
        if(typeof canvas === 'string') canvas = document.getElementById(canvas);
        this.canvas = canvas;
        this.context = context;
        this.offscreen;

        if(!this.workerId) {
            this.initWorker();
            if(typeof setValues === 'object') window.workers.postToWorker({foo:'setValues',args:setValues,origin:this.name},this.workerId,transfer);
        }
        if(canvas) {
            this.setCanvas(canvas);
        }
        if(context) { 
            this.setContext(context);
        }
        if(animation) {
            this.setAnimation(animation);
        }
        
    }

    setContext(context=this.context){
        this.context = context;
        window.workers.postToWorker({context:context, origin:this.name},this.workerId);
    }

    setCanvas(canvas=this.canvas) {
        this.canvas = canvas;
        this.offscreen = canvas.transferControlToOffscreen();
        window.workers.postToWorker({canvas: this.offscreen, origin:this.name, foo:null},this.workerId,[this.offscreen]);
    }

    // {x:3, y:['a','b','c']} etc
    setValues(valObject=undefined,transfer=undefined) {
        if(typeof setValues === 'object') window.workers.postToWorker({foo:'setValues',input:valObject,origin:this.name},this.workerId,transfer);
    }

    //you can reference canvas/this.canvas and context/this.context in the function 
    //Set values then reference this.x etc as well, to have controllable values
    setAnimation(animationFunction) {
        let fstring = animationFunction;
        if(typeof animationFunction === 'function') fstring = animationFunction.toString();
        else if(typeof animationFunction !== 'string') return false;
        //console.log(fstring)
        window.workers.postToWorker({origin:this.name,foo:'setAnimation',input:[fstring]},this.workerId)
    }

    addSetup(setupFunction) {
        if(typeof animationFunction !== 'function') return false;
        let fstring = setupFunction.toString();
        window.workers.postToWorker({origin:this.name,foo:'addFunc',input:['setupAnim',fstring]},this.workerId)
    }

    setThreeAnimation(setupFunction, drawFunction) {
        window.workers.postToWorker({origin:this.name,foo:'initThree',input:[setupFunction.toString(),drawFunction.toString()]})
    }

    startThreeAnimation() {
        window.workers.postToWorker({origin:this.name,foo:'startThree',input:[]},this.workerId);
    }

    clearThreeAnimation() {
        window.workers.postToWorker({origin:this.name,foo:'clearThree',input:[]},this.workerId);
    }

    setValues(values={},transfer=[]) {
        if(typeof values === 'object') {
            window.workers.postToWorker({origin:this.name,foo:'setValues',input:values},this.workerId,transfer);
        }
    }

    startAnimation() {
        window.workers.postToWorker({origin:this.name,foo:'startAnimation',input:[]},this.workerId);
    }

    stopAnimation() {
        window.workers.postToWorker({origin:this.name,foo:'stopAnimation',input:[]},this.workerId);
    }

    setCanvasSize(w=this.canvas.width,h=this.canvas.height) {
        window.workers.postToWorker({origin:this.name,foo:'resizecanvas',input:[w,h]},this.workerId);
    }

    initWorker() {
        if(!this.workerId) {
            if (window.workers == null){
                window.workers = new WorkerManager()
            }

            this.workerId = window.workers.addWorker(); // add a worker for this DataAtlas analyzer instance
            window.workers.workerResponses.push(this.workeronmessage);
        }
        this.setCanvas();
        this.setContext();
    }

    init(animation) {
        if(!this.workerId) this.initWorker();
        this.setCanvas();
        this.setContext();
        if(animation) this.setAnimation(animation);
    }

    deinit() {
        window.workers.terminate(this.workerId);
    }

    workeronmessage = (msg) => {
        if(msg.origin === this.name) { 
            console.log("Result: ", msg);
        }
    }

    test(id='testcanvas') {
        let canvas = document.getElementById(id)
        if(!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = id;
            document.body.insertAdjacentElement('beforeend',canvas);
        }
        this.canvas = canvas;
        this.context = '2d';

        this.init();

        this.setValues({x:1,y:2,z:3});

        function drawFunc(self, args, origin) {
            if(!self.x) {
                self.x = 1;
                self.y = 2;
                self.z = 3;
            }
            self.ctx.font = '10px serif';
            self.ctx.fillText(`${self.x} + ${self.y} + ${self.z} = ${self.x+self.y+self.z}`,10,50);
        
            self.x++;
            self.z+=2;
        }

        this.setAnimation(drawFunc);

        setTimeout(()=>{this.stopAnimation();},10000);

    }
}