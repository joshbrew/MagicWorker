import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';
import magic from '../../../../../src/package';

export default function BasicExample() {
  
    const ping = useRef(null);
    const output = useRef(null);
  
    useEffect(() => {
      ping.current.onclick = () => {
        magic.run('ping').then(res => {
          if (!res?.error) output.current.innerHTML = res
          else output.current.innerHTML = res.error
  
        }).catch(err => {
          output.current.innerHTML = err.error
        })
        }
    });
  
    return (
      <header className={clsx('hero hero--primary')}>
        <div className="container">
          <h1 className="hero__title">Example</h1>
          <p className="subtitle"><strong>Worker:</strong> <span ref={output}></span></p>
          <div>
            <button ref={ping} className="button button--secondary button--lg">Ping</button>
          </div>
        </div>
      </header>
    );
  }
  