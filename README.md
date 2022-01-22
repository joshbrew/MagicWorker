## MagicWorker

`npm i magicworker`


> Note: The frontend must be built after Webpacking the library because *Webpack allows for modules to be imported in the worker scope without breaking* 

> To webpack. Download this repo and extract it, run `npm install`. After editing the library, from the main folder use `npm run build` to create the webpacked file `magicworker.js` which can be used in a browser without build tools.


### Major Features

- Use Web Workers i.e. threads conveniently to create sophisticated single-file multithreaded applications. No need to understand the rest!
- Includes several utilities for on-the-fly transferring functions, data, typed arrays, and class objects to execute on the thread.
- Do bulk math operations, use gpujs to create gpu threads with intuitive code-writing. Includes FFT examples.
- Includes worker-based canvas and threejs rendering utilities (use node for easier threejs inclusion) for multithreaded rendering and basic proxy controls.
- Create message channels between threads to keep all operations off of the main thread.

### WorkerManager

On the frontend, you just need to `import {WorkerManager} from 'magicworker`
and create a `const manager = new WorkerManager()`
or include the webpacked `magicworker.js` in your html file, which sets up the WorkerManager reference as `magic`

From there you can run the default functions, add your own by following the template, and easily build whole threading pipelines.

#### WorkerManager Major Functions

##### Adding a thread:
```js

let id = manager.addWorker(); //add a thread and return the id for passing callbacks to that thread

```

##### Running a function on the thread:
```js 

manager.run('ping',undefined,id); //the id is optional if you want to rotate through available threads instead 

//or
let result = await manager.run('ping');

//or
manager.run('ping').then(res => console.log(result)).catch(console.error);
```

##### Adding a function to the thread
```js

manager.addFunction(
    'add', //function name
    function add(self,args,origin){return args[0] + args[1];}, //the function, self references the thread's scope, where you can access saved values or objects etc.
    id //the id of the thread to write to, leave blank to write to all threads
);

manager.run('add',[5,7],id).then(console.log).catch(console.error); //there is a transfer buffer for typedarrays you can use in the function too for faster operations with GIANT datasets

```

##### Set Local Variables in the thread scope
```js

manager.setValues({x:1},id); //sets values on all workers if no id provided, there is a transfer buffer for typedarrays you can use in the function too

```

##### Terminate workers
```js

manager.terminate(id); //leave id blank to terminate all workers

```

##### Establish a message channel between two threads (avoids the main thread)

This is the most advanced usage of the worker API for creating complex pipelines. See below for a multithreaded particle system that passes data to a render thread without touching the main thread.

```js

manager.establishMessageChannel(
    eventName,
    worker1Id,
    worker2Id,
    worker2Response=(self,args,origin)=>{}, //response on the second thread
    functionName, //This tags the function on the first thread that triggers the message channel to send to this worker
    origin //add an origin tag for more specificity of when to trigger the channel
)

```


#### WorkerManager Utilities

#### Events
Allows subscribing to function outputs or outputs from specific origin points (or both) to automate the pipeline

```js

manager.addEvent('threadprocess',worker1Id,'add');

let sub = manager.subEvent('threadprocess',(result)=>{console.log(result);});

manager.unsubEvent('threadprocess',sub); //or leave sub blank to unsubsribe all

```

##### ThreadedCanvas
This class has macros for creating a canvas on a worker, which handles the rendering loop itself. See below for basic and advanced usage

##### ProxyElement
This class lets you mirror element inputs to a proxy, mainly for canvas/threejs operations. From a ThreeJS tutorial.

### Basic usage in an html file, with the webpacked library:
```html

<script src='./magicworker.js' type='module'> 

//ping the worker to that it's working. These are async functions and can be awaited or can use .then() promises to keep threads synchronized
magic.run('ping').then(console.log).catch(console.error);

//lists available function on the worker
magic.run('list')
.then(result => {result.forEach((r) => {document.body.innerHTML+=`${r}<br>`})})
.catch(console.error);

let threadId = magic.workers[0].id; //get the specific id of the thread
let origin = 0; //can name the source of the thread call

magic.addFunction( 
            'add',
            function add(self,args,origin){return args[0]+args[1];},
            threadId//, //can add functions to a specific thread, or all of them if blank
            //origin //optionally identifies source of the call (e.g. between threads or programs)
).then(console.log).catch(console.error);

//creates a subscribable event for specific functions on threads and/or for specific origins of thread calls
magic.addEvent(
    'threadresult',
    threadId,
    'add', // set a specific function call to fire an event for
    origin //and/or set a source location to control event triggers, need at least one of these two
).then(console.log);

//subscribe to events on the frontend
magic.subEvent('threadresult',(res)=>{
    console.log("add result", res);
});

</script>

```


### Canvas usage (via a nodejs-based web app)
```js

import {WorkerManager, ThreadedCanvas} from 'magicworker'

let manager = new WorkerManager(undefined,0);

let canvasWorkerId = workers.addWorker();

let canvas = document.querySelector('canvas'); //canvas in the html page

let draw = (self, args, origin) => {
    let cWidth = self.canvas.width;
    let cHeight = self.canvas.height;
        // style the background
    let gradient = self.ctx.createRadialGradient(cWidth*0.5,cHeight*0.5,2,cWidth*0.5,cHeight*0.5,100*self.angle*self.angle);
    gradient.addColorStop(0,"purple");
    gradient.addColorStop(0.25,"dodgerblue");
    gradient.addColorStop(0.32,"skyblue");
    gradient.addColorStop(1,self.bgColor ?? 'black');
    self.ctx.fillStyle = gradient;
    self.ctx.fillRect(0,0,cWidth,cHeight);
    
    // draw the circle
    self.ctx.beginPath();

    self.angle += self.angleChange;

    let radius = cHeight*0.04 + (cHeight*0.46) * Math.abs(Math.cos(self.angle));
    self.ctx.arc(cWidth*0.5, cHeight*0.5, radius, 0, Math.PI * 2, false);
    self.ctx.closePath();
    
    // color in the circle
    self.ctx.fillStyle = self.cColor;
    self.ctx.fill();
    
}

let canvasWorker = new ThreadedCanvas(       /
    manager,
    canvas,                                  //canvas element to transfer to offscreencanvas
    '2d',                                    //canvas context setting       
    draw,                                    //pass the custom draw function
    {angle:0,angleChange:0.000,bgColor:'black',cColor:'red'}, //'self' values, canvas and context/ctx are also available under 'self' for now, these can be mutated like uniforms on the thread with the 'setValues' command
    canvasWorkerId                           //worker id to use, if undefined it sets up its own worker
);

canvasWorker.startAnimation();

canvasWorker.setValues({angleChange:0.001}); //set the rate of change for the circle

```

### Advanced ThreeJS usage with several threads doing their own calculations 
```js

import {WorkerManager, ThreadedCanvas, ProxyElement} from 'magicworker'
import {DynamicParticles} from 'dynamicparticles' //another library for this example

let manager = new WorkerManager();

let worker1Id = workers.addWorker();
let worker2Id = workers.addWorker();
let canvasWorkerId = workers.addWorker();

let canvas = document.querySelector('canvas'); //canvas in the html page
let origin = 0; //main thread Id

let canvasWorker = new ThreadedCanvas(   
    manager,
    canvas,        //canvas element to transfer to offscreencanvas
    undefined,   //canvas context setting       
    undefined,  //pass the custom draw function
    undefined,  //'this' values, canvas and context/ctx are also available under 'self' for now, these can be mutated like uniforms with the 'setValues' command
    canvasWorkerId,   //worker id to use, if undefined it sets up its own worker
    origin,     
    undefined //transfer values
);

//create a proxy for the canvas on the worker thread to mirror key inputs 
let proxy = initElementProxy(
    canvas,
    canvasWorkerId,
    origin
);


//these functions run on the worker scope and have expected parameters
function particleSetup(self, args, origin){
    //console.log(self);
    self.particleObj = new self.particleClass(undefined,undefined,false,false);
    self.particleObj.setupRules(args[0]);

    if(typeof args[1] === 'object') self.particleObj.updateGroupProperties(args[4],args[1],args[2],args[3]); //can set some initial properties
    //use an arraybuffer system for MUCH FASTER transfers
    //https://developer.mozilla.org/en-US/docs/Glossary/Transferable_objects
    //https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast

    let groups = [];
    let positionbuffer = [];
    let bufferidx = -1;
    let p = 0;
    self.particleObj.particles.map((group,j) => {
        // if(j > bufferidx) {
        //     positionbuffer.push(...new Array(group.particles.length*3));
        //     bufferidx = j;
        // }
        groups.push(new Array(group.length));
        group.particles.map((particle, k) => {
            groups[j][k]=[particle.position.x,particle.position.y,particle.position.z];
            // positionbuffer[p]=particle.position.x;
            // positionbuffer[p+1]=particle.position.y;
            // groups[p+2]=particle.position.z;
            // p+=3;
        });
    });
    //console.log(groups)
    return groups;
    //return Float32Array.from(positionbuffer);
}

function particleStep(self, args, origin){
    self.particleObj.frame(args[0]);
    //use an arraybuffer system for MUCH FASTER transfers
    //https://developer.mozilla.org/en-US/docs/Glossary/Transferable_objects
    //https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast
    //let groups = [];
    let positionbuffer = [];
    let bufferidx = -1;
    let p = 0;
    self.particleObj.particles.map((group,j) => {
        if(j > bufferidx) {
            positionbuffer.push(...new Array(group.particles.length*3));
            bufferidx = j;
        }
        group.particles.map((particle, k) => {
            positionbuffer[p]=particle.position.x;
            positionbuffer[p+1]=particle.position.y;
            positionbuffer[p+2]=particle.position.z;
            p+=3;
        });
    });

    return {pos:Float32Array.from(positionbuffer),time:self.particleObj.currFrame}; //will automatically be transferred as our worker checks for TypedArrays
}

function setGroupProperties(self, args, origin){
    if(typeof args[0] === 'object') {
        if(!args[3]) {
            self.particleObj.particles.forEach((p,i) => {
                self.particleObj.updateGroupProperties(i,args[0],args[1],args[2]);
            });
        } else {
            self.particleObj.updateGroupProperties(args[3],args[0],args[1],args[2]);
        }
        return true;
    }
    return false;
}


const boidsSetup = (self, args, origin) => {
    if(!self.boids) {console.error('need to add boids to the worker first setValues({boids:[[{x,y,z}],[etc.]]')}
    let three = self.threeUtil;
    const THREE = self.THREE;

    if(three.ANIMATING) {
        three.clear(self, args, origin);
    }

    three.scene = new THREE.Scene();
    three.camera = new THREE.PerspectiveCamera(75, three.proxy.clientWidth / three.proxy.clientHeight, 0.01, 1000);
    three.camera.position.z = 5
    
    three.renderer = new THREE.WebGLRenderer({canvas:self.canvas, antialias: true });
    three.renderer.setPixelRatio(Math.min(three.proxy.clientWidth / three.proxy.clientHeight,2));
    three.renderer.shadowMap.enabled = true;

    three.resizeRendererToDisplaySize(three.renderer,three.proxy,three.camera);
    // three.renderer.domElement.style.width = '100%';
    // three.renderer.domElement.style.height = '100%';
    // three.renderer.domElement.id = `canvas`;
    // three.renderer.domElement.style.opacity = '0';
    // three.renderer.domElement.style.transition = 'opacity 1s';

    //use proxy instead of domElement
    three.controls = new three.OrbitControls(three.camera, three.proxy);
    three.controls.enablePan = true
    three.controls.enableDamping = true
    three.controls.enabled = true;
    // three.controls.minPolarAngle = 2*Math.PI/6; // radians
    // three.controls.maxPolarAngle = 4*Math.PI/6; // radians
    // three.controls.minDistance = 0; // radians
    // three.controls.maxDistance = 1000; // radians

    three.nBoids = self.maxParticles;
    //console.log(self.boids)
    //array of position arrays input

    let vertices = [];

    let color = new THREE.Color();
    let colors = [];
    self.boids.forEach((group,i)=> {

        group.forEach((boid)=>{

            let x = boid[0];
            let y = boid[1];
            let z = -boid[2];

            vertices.push( x, y, z );

            let roll = Math.random();
            if(i==0){
                if(roll <= 0.3){
                    color.set('lightseagreen');
                } else if (roll <= 0.85){
                    color.set('blue');
                } else {
                    color.set('turquoise');
                }
                colors.push(color.r,color.g,color.b);
            }
            else if (i==1) {
                if(roll <= 0.3){
                    color.set('pink');
                } else if (roll <= 0.85){
                    color.set('red');
                } else {
                    color.set('orange');
                }
                colors.push(color.r,color.g,color.b);
            }
            else {
                color.setRGB(Math.random(),Math.random(),Math.random());
                colors.push(color.r,color.g,color.b);
            }
        });
    });

    self.boids = new Array(self.maxParticles);

    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    
    // for (let i = 0; i < three.nBoids; i++) {     
    // }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute( colors, 3));

    let pointmat = new THREE.PointsMaterial( 
        // { color: 0xffffff },
        { 
            vertexColors: THREE.VertexColors,
            opacity:0.99
        });

    /*
    var spriteUrl = 'https://i.ibb.co/NsRgxZc/star.png';

    var textureLoader = new THREE.TextureLoader()
    textureLoader.crossOrigin = "Anonymous"
    var myTexture = textureLoader.load(spriteUrl);
    pointmat.map = myTexture;
    */
    three.points = new THREE.Points( geometry, pointmat );

    three.points.position.y -=225;
    three.points.position.x -=225
    three.points.position.z +=75;

    three.scene.add( three.points );
    
    if(!three.ANIMATING) {
        three.ANIMATING = true;
        three.animate(self, args, origin);
    }
    
    for(let j = 0; j < self.nGroups; j++) {
        let portj = self['particleSetup'+j+'port'];
        if(portj) {
            requestAnimationFrame( //let the particle thread know that the render thread is ready for more data (throttled by framerate)
                ()=>{
                    portj.postMessage({foo:'particleStep',input:[performance.now()*0.001],origin:origin});
                }
            ); 
        }
    }
}

const boidsRender = (self, args, origin) => {

        let three = self.threeUtil;

        three.resizeRendererToDisplaySize(three.renderer,three.proxy,three.camera);
        
        //console.log(self.boids)
        if(self.boids.length === self.maxParticles*3) {
        
            let positions = three.points.geometry.attributes.position.array;
            let count = 0;
        
            //console.log(self.boids);
            let positionArray = self.boids;//Array.from(self.boids); //convert float32array

            //updated with setValues
            for(let count = 0; count< positionArray.length; count+=3 ) {
                positions[count]   =  positionArray[count];
                positions[count+1] =  positionArray[count+1];
                positions[count+2] = -positionArray[count+2];
            }

            three.points.geometry.attributes.position.needsUpdate = true; 
        }   

        three.controls.update();
        three.renderer.render(three.scene, three.camera);
}


let maxParticles = 10000;
            
let particleSettings = [
    ['boids',4000,[450,450,450]],
    ['boids',5000,[450,450,450]],
    ['boids',1000,[450,450,450]]
];



canvasWorker.setValues({
    boids:[],
    particleSettings:particleSettings,
    maxParticles:maxParticles,
    nGroups:particleSettings.length,
    groupsSetup:0,
    proxyId: proxy.id,
    setupfstring: boidsSetup.toString(),
    renderfstring: boidsRender.toString()
});


//now we're going to create a worker for each particle system
let particleWorkers = [];
particleSettings.forEach((s,i) => {
    let workerId = workers.addWorker();
    particleWorkers.push(workerId);
    
    workers.runWorkerFunction('transferClassObject',{particleClass:DynamicParticles.toString()},origin,workerId);
    // //add some custom functions to the threads
    workers.addWorkerFunction(
        'particleSetup',
        particleSetup,
        origin,
        workerId
    );
    
    //add some custom functions to the threads
    workers.addWorkerFunction(
        'particleStep',
        particleStep,
        origin,
        workerId
    );

    //add some custom functions to the threads
    workers.addWorkerFunction(
        'setGroupProperties',
        setGroupProperties,
        origin,
        workerId
    );

    //direct communication channel between particle and render threads
    workers.establishMessageChannel(
        'particleSetup'+i,
        workerId,
        canvasWorkerId,
        function worker2Response(self,args,origin,port,eventName){
            //args = [float32array] from particle1Step output

            //console.log(args,eventName);
            args.output.forEach((arr) => {
                self.boids[parseInt(eventName[eventName.length-1])] = arr;
                self.groupsSetup++;
            })
            if(self.groupsSetup === self.nGroups) {
                //console.log(self.boids);
                self.runCallback( //init once we've received the initial boids data 
                    'initThree',
                    [
                        self.proxyId,
                        undefined,
                        self.setupfstring, //CONVERT TO STRING
                        //undefined,
                        self.renderfstring,
                        undefined
                    ],
                    origin
                );
                //console.log(self)
                //need to dispatch to all ports to begin animating
                
            }

            
        },
        'particleSetup',
        origin
    );

    //direct communication channel between particle and render threads
    workers.establishMessageChannel(
        'particleStep'+i,
        workerId,
        canvasWorkerId,
        function worker2Response(self,args,origin,port,eventName){
            //args = [float32array] from particle1Step output
            //console.log(args.output,output.length);
            let output = Array.from(args.output.pos);
            let idx = parseInt(eventName[eventName.length-1]);
            let offset = 0;
            let j = 0;

            while(j < idx) {
                offset+=self.particleSettings[j][1]*3;
                j++;
            }

            self.boids.splice(offset, output.length, ...output );
            
            //console.log(offset,output.length);

            //if(idx === 2) console.log(self.boids);
            if(port) {
                requestAnimationFrame( //let the particle thread know that the render thread is ready for more data (throttled by framerate)
                    ()=>{
                        port.postMessage({foo:'particleStep',input:[args.output.time],origin:origin});
                    }
                ); 
            }
        },
        'particleStep',
        origin
    );


    workers.runWorkerFunction('particleSetup',[[particleSettings[i]]],origin,workerId);
    //window.workers.runWorkerFunction('particleSetup',particlesettings,origin,worker1Id);
    

});


```


Joshua Brewster and Garrett Flynn

License AGPL v3.0
