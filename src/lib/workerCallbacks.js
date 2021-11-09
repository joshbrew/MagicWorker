import { gpuUtils } from 'gpujsutils';
import { Math2 } from './Math2';
import { Events } from './Event.js';
import { ProxyManager } from './ProxyElement.js';

let dynamicImport = async (url) => {
  let module = await import(url);
  return module;
}

//Get the text inside of a function (regular or arrow);
function getFunctionBody(methodString) {
  return methodString.toString().replace(/^\W*(function[^{]+\{([\s\S]*)\}|[^=]+=>[^{]*\{([\s\S]*)\}|[^=]+=>(.+))/i, '$2$3$4');
}

function getFunctionHead(methodString) {
  let fnstring = methodString.toString();
  return fnstring.slice(0, fnstring.indexOf('{') + 1);
}

function buildNewFunction(head, body) {
  let newFunc = eval(head + body + '}');
  return newFunc;
}

function isFunction(string) {
  let regex = new RegExp('(|[a-zA-Z]\w*|\([a-zA-Z]\w*(,\s*[a-zA-Z]\w*)*\))\s*=>')
  let func = (typeof string === 'string') ? string.substring(0,10).includes('function') : false;
  let arrow = (typeof string === 'string') ? regex.test(string) : false;
  if(func || arrow) return true;
  else return false;
}

function parseFunctionFromText(method) {
  //Get the text inside of a function (regular or arrow);
  let getFunctionBody = (methodString) => {
    return methodString.replace(/^\W*(function[^{]+\{([\s\S]*)\}|[^=]+=>[^{]*\{([\s\S]*)\}|[^=]+=>(.+))/i, '$2$3$4');
  }

  let getFunctionHead = (methodString) => {
    let startindex = methodString.indexOf(')');
    return methodString.slice(0, methodString.indexOf('{',startindex) + 1);
  }

  let newFuncHead = getFunctionHead(method);
  let newFuncBody = getFunctionBody(method);

  let newFunc;
  if (newFuncHead.includes('function ')) {
    let varName = newFuncHead.split('(')[1].split(')')[0]
    newFunc = new Function(varName, newFuncBody);
  } else {
    if(newFuncHead.substring(0,6) === newFuncBody.substring(0,6)) {
      //newFuncBody = newFuncBody.substring(newFuncHead.length);
      let varName = newFuncHead.split('(')[1].split(')')[0]
      //console.log(varName, newFuncHead ,newFuncBody);
      newFunc = new Function(varName, newFuncBody.substring(newFuncBody.indexOf('{')+1,newFuncBody.length-1));
    }
    else newFunc = eval(newFuncHead + newFuncBody + "}");
  }

  return newFunc;

}


export class CallbackManager {
  constructor() {

    try {
      window.gpu = new gpuUtils();
      this.gpu = window.gpu;
    } catch {
      let gpu = new gpuUtils();
      this.gpu = gpu;
    }

    this.EVENTS = new Events();
    this.EVENTSETTINGS = [];


    this.canvas = new OffscreenCanvas(512, 512); //can add fnctions and refer to this.offscreen 
    this.ctx; this.context;
    this.ANIMATION = undefined;
    this.ANIMATIONFUNC = undefined;
    this.ANIMATING = false;
    this.ANIMFRAMETIME = performance.now(); //ms based on UTC stamps
    this.threeUtil = undefined;
    this.PROXYMANAGER = new ProxyManager();
    this.ID = Math.floor(Math.random()*1000); //just a reference for discerning threads 
    
    try{
      if(window) console.log('worker in window!');
    } catch(err) {
      self.document = {}; //threejs hack
    }

    //args = array of expected arguments
    //origin = optional tag on input object
    //self = this. scope for variables within the callbackmanager (including values set)

    this.callbacks = [
      { //ping pong, just validates responsiveness
        case: 'ping', callback: (self, args, origin) => {
          return 'pong';
        }
      },
      { //return a list of function calls available on the worker
        case: 'list', callback: (self, args, origin) => {
          let list = [];
          this.callbacks.forEach((obj) => {
            list.push(obj.case);
          });
          return list;
        }
      },
      { //add a local function, can implement whole algorithm pipelines on-the-fly
        case: 'addfunc', callback: (self, args, origin) => { //arg0 = name, arg1 = function string (arrow or normal)
          let newFunc = parseFunctionFromText(args[1]);

          let newCallback = { case: args[0], callback: newFunc };

          let found = self.callbacks.findIndex(c => { if (c.case === newCallback.case) return c });
          if (found != -1) self.callbacks[found] = newCallback;
          else self.callbacks.push(newCallback);
          return true;
        }
      },
      { //set locally accessible values, just make sure not to overwrite the defaults in the callbackManager
        case: 'setValues', callback: (self, args, origin) => {
          if (typeof args === 'object') {
            Object.keys(args).forEach((key) => {
              self[key] = args[key]; //variables will be accessible in functions as this.x or this['x']
              if (self.threeUtil) self.threeUtil[key] = args[key];
            });
            return true;
          } else return false;
        }
      },
      { //parses a stringified class prototype (class x{}.toString()) containing function methods for use on the worker
        case: 'transferClassObject', callback: (self, args, origin) => {
          if (typeof args === 'object') {
            Object.keys(args).forEach((key) => {
              if(typeof args[key] === 'string') {
                let obj = args[key];
                if(args[key].indexOf('class') === 0) obj = eval('('+args[key]+')');
                self[key] = obj; //variables will be accessible in functions as this.x or this['x']
                //console.log(self,key,obj);
                if (self.threeUtil) self.threeUtil[key] = obj;
              }
            });
            return true;
          } else return false;
        }
      },
      { //add a gpu function call usable in kernels, follow gpujs's tutorials and pass stringified functions using their format
        case: 'addgpufunc', callback: (self, args, origin) => { //arg0 = gpu in-thread function string
          return self.gpu.addFunction(parseFunctionFromText(args[0]));
        }
      },
      { //add a gpu kernels, follow gpujs's tutorials and pass stringified functions using their format
        case: 'addkernel', callback: (self, args, origin) => { //arg0 = kernel name, arg1 = kernel function string
          return self.gpu.addKernel(args[0], parseFunctionFromText(args[1]));
        }
      },
      { //call a custom gpu kernel
        case: 'callkernel', callback: (self, args, origin) => { //arg0 = kernel name, args.slice(1) = kernel input arguments
          return self.gpu.callKernel(args[0], args.slice(1)); //generalized gpu kernel calls
        }
      },
      { //MessageChannel port, it just runs the whole callback system to keep it pain-free, while allowing messages from other workers
        case: 'addport', callback: (self, args, origin) => { //args[0] = eventName, args[1] = case, only fires event if from specific same origin
          let port = args[1];
          port.onmessage = onmessage; //sets up a new receiver source (from other workers, perform addevent on the other worker)
          this[args[0]] = port; //locally 
        }
      },
      { //add an event to the event manager, this helps building automated pipelines between threads
        case: 'addevent', callback: (self, args, origin) => { //args[0] = eventName, args[1] = case, only fires event if from specific same origin
          self.EVENTSETTINGS.push({ eventName: args[0], case: args[1], port:args[2], origin: origin });
          //console.log(args);
          if(args[2]){ 
            let port = args[2];
            port.onmessage = onmessage; //attach the port onmessage event
            this[args[0]+'port'] = port;
            return true;
          }
          return false;
        }
      },
      { //internal event subscription, look at Event.js for usage, its essentially a function trigger manager for creating algorithms
        case: 'subevent', callback: (self, args, origin) => { //args[0] = eventName, args[1] = response function(self,args,origin) -> lets you reference self for setting variables
          if(typeof args[0] !== 'string') return false;
          
          let response = parseFunctionFromText(args[1]);
          let eventSetting = this.checkEvents(args[0]); //this will contain the port setting if there is any
          //console.log(args, eventSetting)
          return self.EVENTS.subEvent(args[0], (output) => {
            response(self,output,origin,eventSetting?.port,eventSetting?.eventName); //function wrapper so you can access self from the event subscription
          });
        }
      },
      { //internal event unsubscribe
        case: 'unsubevent', callback: (self, args, origin) => { //args[0] = eventName, args[1] = case, only fires event if from specific same origin
          return self.EVENTS.unsubEvent(args[0], args[1]);
        }
      },
      { //resize an offscreen canvas
        case: 'resizecanvas', callback: (self, args, origin) => {
          self.canvas.width = args[0];
          self.canvas.height = args[1];
          return true;
        }
      }, 
      { //args[0] = ProxyManager Id returned from startProxy, args[1] = event object
        case:'proxyHandler', callback: (self, args, origin) => {

          if(args.type === 'makeProxy') {
            self.PROXYMANAGER.makeProxy(args);

            const proxy = self.PROXYMANAGER.getProxy(args.id); 
            proxy.ownerDocument = proxy; // HACK!
            self[args.id] = proxy;
          } else if (args.type === 'event') {
            self.PROXYMANAGER.handleEvent(args);
          }
          else return false;

          return true;
        }
      },
      {
        case: 'initThree', callback: async (self, args, origin) => {
          if (self.ANIMATING) {
            self.ANIMATING = false;
            cancelAnimationFrame(self.ANIMATION);
          }
          if (!self.threeUtil) {
            let module = await dynamicImport('./workerThreeUtils.js');
            self.threeUtil = new module.threeUtil(self.canvas,self,self.PROXYMANAGER.getProxy(args[0]));
            self.THREE = self.threeUtil.THREE; //add another reference for the hell of it
          }
          if (typeof args[1] === 'object') { //first is the setup function
            await this.runCallback('setValues',args[1]);
          }
          //console.log(args)
          if (args[2]) { //first is the setup function
            self.threeUtil.setup = parseFunctionFromText(args[2]);
          }
          if (args[3]) { //next is the draw function (for 1 frame)
            self.threeUtil.draw = parseFunctionFromText(args[3]);
          }
          if (args[4]) {
            self.threeUtil.clear = parseFunctionFromText(args[4]);
          }
          self.threeUtil.clear(self, args, origin);
          self.threeUtil.setup(self, args, origin);
          //console.log(self.threeUtil);
          return true;
        }
      },
      {
        case: 'startThree', callback: async (self, args, origin) => { //run the setup to start the three animation
          if (this.ANIMATING) {
            self.ANIMATING = false;
            cancelAnimationFrame(self.ANIMATION);
          }
          if (!this.threeUtil) {
            let module = await dynamicImport('./workerThreeUtils.js');
            //console.log(module);
            self.threeUtil = new module.threeUtil(self.canvas,self,self.PROXYMANAGER.getProxy(args[0]));
          }
          if (this.threeUtil) {
            self.threeUtil.clear(self, args, origin);
            self.threeUtil.setup(self, args, origin);
          }
          return true;
        }
      },
      {
        case: 'clearThree', callback: (self, args, origin) => { //run the clear function to stop three
          if (this.threeUtil) {
            this.threeUtil.clear(self, args, origin);
          }
          return true;
        }
      },
      {case: 'setAnimation', callback: (self, args, origin) => { //pass a draw function to be run on an animation loop. Reference this.canvas and this.context or canvas and context. Reference values with this.x etc. and use setValues to set the values from another thread
          this.animationFunc = parseFunctionFromText(args[0]);
          return true;
        }
      },
      {
        case: 'startAnimation', callback: (self, args, origin) => {
          //console.log(this.animationFunc.toString(), this.canvas, this.angle, this.angleChange, this.bgColor)
          let anim = () => {
            if (self.ANIMATING) {
              self.animationFunc(self, args, origin);
              self.ANIMFRAMETIME = performance.now() - self.ANIMFRAMETIME;
              let emitevent = self.checkEvents('render', origin);
              let dict = { foo: 'render', output: self.ANIMFRAMETIME, origin: origin};
              self.ANIMFRAMETIME = performance.now();
              if (emitevent) {
                self.EVENTS.emit('render', dict);
              }
              else {
                postMessage(dict);
              }
              requestAnimationFrame(anim);
            }
          }

          if (this.ANIMATING) {
            self.ANIMATING = false;
            cancelAnimationFrame(self.ANIMATION);
            setTimeout(() => {
              self.ANIMATING = true;
              self.ANIMATION = requestAnimationFrame(anim);
            }, 300);
          } else {
            self.ANIMATING = true;
            console.log('begin animation')
            self.ANIMATION = requestAnimationFrame(anim);
          }
          return true;
        }
      },
      {
        case: 'stopAnimation', callback: (self, args, origin) => {
          if (self.ANIMATING) {
            self.ANIMATING = false;
            cancelAnimationFrame(self.ANIMATION);
            return true;
          } else return false;
        }
      },
      {
        case: 'render', callback: (self, args, origin) => { //runs the animation function
          self.animationFunc(self, args, origin);
          let time = performance.now() - self.ANIMFRAMETIME
          tselfhis.ANIMFRAMETIME = performance.now();
          return time;
        }
      },
      { 
        case: 'xcor', callback: (self, args, origin) => { 
          return Math2.crosscorrelation(...args); 
        } 
      },
      { 
        case: 'autocor', callback: (self, args, origin) => { 
          return Math2.autocorrelation(args); 
        } 
      },
      { 
        case: 'cov1d', callback: (self, args, origin) => { 
          return Math2.cov1d(...args); } 
        },
      { 
        case: 'cov2d', callback: (self, args, origin) => { 
          return Math2.cov2d(args); } 
        },
      { 
        case: 'sma', callback: (self, args, origin) => { 
          return Math2.sma(...args); } 
        },
      {
        case: 'dft', callback: (self, args, origin) => {
          if (args[2] == undefined) args[2] = 1;
          return self.gpu.gpuDFT(...args);
        }
      },
      {
        case: 'multidft', callback: (self, args, origin) => {
          if (args[2] == undefined) args[2] = 1;
          return self.gpu.MultiChannelDFT(...args);
        }
      },
      {
        case: 'multidftbandpass', callback: (self, args, origin) => {
          if (args[4] == undefined) args[4] = 1;
          return self.gpu.MultiChannelDFT_Bandpass(...args);
        }
      },
      {
        case: 'fft', callback: (self, args, origin) => {
          if (args[2] == undefined) args[2] = 1;
          return self.gpu.gpuFFT(...args);
        }
      },
      {
        case: 'multifft', callback: (self, args, origin) => {
          if (args[2] == undefined) args[2] = 1;
          return self.gpu.MultiChannelFFT(...args);
        }
      },
      {
        case: 'multifftbandpass', callback: (self, args, origin) => {
          if (args[4] == undefined) args[4] = 1;
          return self.gpu.MultiChannelFFT_Bandpass(...args);
        }
      },
      { 
        case: 'gpucoh', callback: (self, args, origin) => { 
          return self.gpu.gpuCoherence(...args); } 
        },
      {
        case: 'coherence', callback: (self, args, origin) => {
          const correlograms = Math2.correlograms(args[0]);
          const buffer = [...args[0], ...correlograms];
          var dfts;

          var scalar = 1;
          //console.log(mins)
          //console.log(buffer);
          dfts = self.gpu.MultiChannelDFT_Bandpass(buffer, args[1], args[2], args[3], scalar);
          //console.log(dfts)
          const cordfts = dfts[1].splice(args[0].length, buffer.length - args[0].length);
          //console.log(cordfts)

          const coherenceResults = [];
          const nChannels = args[0].length;

          //cross-correlation dfts arranged like e.g. for 4 channels: [0:0, 0:1, 0:2, 0:3, 1:1, 1:2, 1:3, 2:2, 2:3, 3:3] etc.
          var k = 0;
          var l = 0;
          cordfts.forEach((row, i) => { //move autocorrelation results to front to save brain power
            if (l + k === nChannels) {
              var temp = cordfts.splice(i, 1);
              k++;
              cordfts.splice(k, 0, ...temp);
              l = 0;
              //console.log(i);
            }
            l++;
          });
          //Now arranged like [0:0,1:1,2:2,3:3,0:1,0:2,0:3,1:2,1:3,2:3]

          //Outputs FFT coherence data in order of channel data inputted e.g. for 4 channels resulting DFTs = [0:1,0:2,0:3,1:2,1:3,2:3];

          var autoFFTproducts = [];
          k = 0;
          l = 1;
          cordfts.forEach((dft, i) => {
            var newdft = new Array(dft.length).fill(0);
            if (i < nChannels) { //sort out autocorrelogram FFTs
              dft.forEach((amp, j) => {
                newdft[j] = amp//*dfts[1][i][j];
              });
              autoFFTproducts.push(newdft);
            }
            else { //now multiply cross correlogram ffts and divide by autocorrelogram ffts (magnitude squared coherence)
              dft.forEach((amp, j) => {
                newdft[j] = amp * amp / (autoFFTproducts[k][j] * autoFFTproducts[k + l][j]);//Magnitude squared coherence;
                if (newdft[j] > 1) { newdft[j] = 1; } //caps the values at 1
                //newdft[j] = Math.pow(newdft[j],.125)
              });
              l++;
              if ((l + k) === nChannels) {
                k++;
                l = 1;
              }
              coherenceResults.push(newdft);
            }
          });
          return [dfts[0], dfts[1], coherenceResults];
        }
      }
    ];
  }

  async runCallback(foo,input=[],origin) {
    let output = 'function not defined';
    await Promise.all(this.callbacks.map(async (o,i) => {
      if (o.case === foo) {
        if (input) output = await o.callback(this, input, origin);
        return true;
      } else return false;
    }));
    return output;
  }

  checkEvents(foo, origin) {
    let found = this.EVENTSETTINGS.find((o) => {
      if ((o.origin && origin && o.case && foo)) {
        if (o.origin === origin && o.case === foo) return true;
        else return false;
      } else if (o.case && foo) {
        if (o.case === foo) return true;
        else return false;
      } else if (o.origin && origin) {
        if(o.origin === origin) return true;
        else return false;
      }
      else return false;
    });
    //console.log(foo,origin,found)
    return found;
  }

  async checkCallbacks(event) {
    let output = 'function not defined';
    if(!event.data) return output;
    await Promise.all(this.callbacks.map(async (o,i) => {
      if (o.case === event.data.foo || o.case === event.data.case) {
        if (event.data.input) output = await o.callback(this, event.data.input, event.data.origin);
        else if (event.data.args) output = await o.callback(this, event.data.args, event.data.origin);
        return true;
      } else return false;
    }));
    return output;
  }
}