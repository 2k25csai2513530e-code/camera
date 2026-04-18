const video = document.getElementById('video');
        const bgCanvas = document.getElementById('bgCanvas');
        const fxCanvas = document.getElementById('fxCanvas');
        const bgCtx = bgCanvas.getContext('2d');
        const fxCtx = fxCanvas.getContext('2d', { alpha: true });
        
        let currentTheme = 'purple';
        window.setTheme = (t) => currentTheme = t;

        function resize() {
            bgCanvas.width = fxCanvas.width = window.innerWidth;
            bgCanvas.height = fxCanvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resize);
        resize();

        // Particle System Trailing
        let particles = [];
        class Particle {
            constructor(x, y, hue) {
                this.x = x; this.y = y; this.hue = hue;
                this.vx = (Math.random() - 0.5) * 6;
                this.vy = (Math.random() - 0.5) * 6;
                this.life = 1.0;
                this.decay = Math.random() * 0.03 + 0.02;
                this.size = Math.random() * 4 + 2;
            }
            draw(ctx) {
                ctx.fillStyle = `hsla(${this.hue}, 100%, 70%, ${this.life})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
                ctx.fill();
            }
        }

        // Camera Initialization
        navigator.mediaDevices.getUserMedia({video: {facingMode: 'user', width: {ideal: 1280}, height: {ideal: 720}}})
            .then(stream => { video.srcObject = stream; })
            .catch(e => { alert("Camera Access Denied or not available."); });

        const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
        hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        
        const HAND_CONNECTIONS = [
            [0,1], [1,2], [2,3], [3,4], // Thumb
            [0,5], [5,6], [6,7], [7,8], // Index
            [5,9], [9,10], [10,11], [11,12], // Middle
            [9,13], [13,14], [14,15], [15,16], // Ring
            [13,17], [0,17], [17,18], [18,19], [19,20] // Pinky & Palm
        ];

        let drawParams = { scaleW:0, scaleH:0, offsetX:0, offsetY:0 };

        function getHue(theme, handIdx, fingerIdx) {
            if (theme === 'purple') return 280;
            if (theme === 'gold') return 40;
            if (theme === 'cyan') return 180;
            if (theme === 'rainbow') return (fingerIdx * 45) % 360; // Spread hues across fingers
            return 280;
        }

        function drawFiberStrands(ctx, pathFunc, hue, alpha) {
            ctx.save();
            // 4 Glow Layers
            const layers = [
                { width: 25, blur: 30, color: `hsla(${hue}, 100%, 50%, ${alpha * 0.3})` }, // Wide Outer Bloom
                { width: 12, blur: 15, color: `hsla(${hue}, 100%, 60%, ${alpha * 0.6})` }, // Mid Halo
                { width: 5,  blur: 5,  color: `hsla(${hue}, 100%, 80%, ${alpha * 0.9})` }, // Tight Inner
                { width: 1.5,blur: 0,  color: `rgba(255, 255, 255, ${alpha})` } // White Hot Core
            ];

            layers.forEach(layer => {
                ctx.beginPath();
                pathFunc();
                ctx.lineWidth = layer.width;
                ctx.strokeStyle = layer.color;
                ctx.shadowBlur = layer.blur;
                ctx.shadowColor = layer.color;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();
            });

            // 5 Parallel Strands (Offsetting coordinates mechanically takes too long, we use multi-strokes)
            // Simulating parallel by using tight inner strokes slightly transparent
            ctx.beginPath();
            pathFunc();
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.stroke();
            ctx.restore();
        }

        function drawDarkWiderFiberStrands(ctx, pathFunc, hue, alpha) {
            ctx.save();
            // Deep, dark layers designed to contrast sharply against bright/white backgrounds
            const layers = [
                { width: 45, blur: 15, color: `rgba(0, 0, 0, ${alpha * 0.2})` }, // Black outer halo
                { width: 22, blur: 10, color: `hsla(${hue}, 90%, 15%, ${alpha * 0.6})` }, // Very dark themed glow
                { width: 10, blur: 2,  color: `hsla(${hue}, 100%, 25%, ${alpha * 0.9})` }, // Dark core
                { width: 3,  blur: 0,  color: `rgba(20, 20, 20, ${alpha})` } // Almost black inner thread
            ];

            layers.forEach(layer => {
                ctx.beginPath();
                pathFunc();
                ctx.lineWidth = layer.width;
                ctx.strokeStyle = layer.color;
                ctx.shadowBlur = layer.blur;
                ctx.shadowColor = layer.color;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();
            });

            ctx.beginPath();
            pathFunc();
            ctx.lineWidth = 1.0;
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.8})`; // Pure black fine line
            ctx.stroke();
            ctx.restore();
        }


        hands.onResults((results) => {
            const splash = document.getElementById('splash');
            if (splash.style.display !== 'none') splash.style.display = 'none';

            let handCount = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
            document.getElementById('status').innerText = `HANDS DETECTED: ${handCount}`;
            
            // BG Mirror
            const imgRatio = results.image.width / results.image.height;
            const canvasRatio = bgCanvas.width / bgCanvas.height;
            if (imgRatio > canvasRatio) {
                drawParams.scaleH = bgCanvas.height;
                drawParams.scaleW = results.image.width * (bgCanvas.height / results.image.height);
                drawParams.offsetX = (bgCanvas.width - drawParams.scaleW) / 2;
                drawParams.offsetY = 0;
            } else {
                drawParams.scaleW = bgCanvas.width;
                drawParams.scaleH = results.image.height * (bgCanvas.width / results.image.width);
                drawParams.offsetX = 0;
                drawParams.offsetY = (bgCanvas.height - drawParams.scaleH) / 2;
            }
            bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
            bgCtx.drawImage(results.image, drawParams.offsetX, drawParams.offsetY, drawParams.scaleW, drawParams.scaleH);

            fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

            // Update & Draw Particles
            for (let i = particles.length - 1; i >= 0; i--) {
                let p = particles[i];
                p.x += p.vx; p.y += p.vy;
                p.life -= p.decay;
                if (p.life <= 0) particles.splice(i, 1);
                else {
                    fxCtx.shadowBlur = 10;
                    fxCtx.shadowColor = `hsl(${p.hue}, 100%, 50%)`;
                    p.draw(fxCtx);
                    fxCtx.shadowBlur = 0;
                }
            }

            if (handCount > 0) {
                const mapPoint = p => ({ x: drawParams.offsetX + p.x * drawParams.scaleW, y: drawParams.offsetY + p.y * drawParams.scaleH });
                const handsData = results.multiHandLandmarks.map(h => h.map(mapPoint));

                // 1. Draw Intra-hand Skeletons
                handsData.forEach((handCoords, handIdx) => {
                    const themeHue = getHue(currentTheme, handIdx, 0); // Base hue
                    
                    // Path function for skeleton
                    const skeletonPath = () => {
                        HAND_CONNECTIONS.forEach(([i, j]) => {
                            fxCtx.moveTo(handCoords[i].x, handCoords[i].y);
                            fxCtx.lineTo(handCoords[j].x, handCoords[j].y);
                        });
                    };
                    drawFiberStrands(fxCtx, skeletonPath, themeHue, 1.0);

                    // Fingertips (4, 8, 12, 16, 20) Sparkles & Particles
                    [4, 8, 12, 16, 20].forEach((tipIdx, fIdx) => {
                        const tip = handCoords[tipIdx];
                        const hue = currentTheme === 'rainbow' ? getHue(currentTheme, handIdx, fIdx) : themeHue;
                        
                        // Sparkle Dot
                        fxCtx.beginPath();
                        fxCtx.arc(tip.x, tip.y, 6, 0, Math.PI*2);
                        fxCtx.fillStyle = '#fff';
                        fxCtx.shadowBlur = 20;
                        fxCtx.shadowColor = `hsl(${hue}, 100%, 50%)`;
                        fxCtx.fill();
                        fxCtx.shadowBlur = 0;

                        // Spawn Trail particles
                        if (Math.random() > 0.3) particles.push(new Particle(tip.x, tip.y, hue));
                    });
                });

                // 2. Draw Inter-hand Cross Threads if 2 hands
                if (handCount === 2) {
                    const h1 = handsData[0];
                    const h2 = handsData[1];
                    const distCenters = Math.hypot(h1[0].x - h2[0].x, h1[0].y - h2[0].y);
                    
                    // Max distance where they are visible
                    const maxDist = bgCanvas.height * 1.5; 
                    // Alpha goes high when close
                    let alpha = Math.max(0, 1.0 - (distCenters / maxDist));
                    alpha = Math.pow(alpha, 2); // Exaggerate brightness when getting close
                    
                    if (alpha > 0.05) {
                        const blendHue = (getHue(currentTheme, 0, 0) + getHue(currentTheme, 1, 0)) / 2;
                        
                        // Batched path for all 441
                        const crossPath = () => {
                            for(let i=0; i<21; i++) {
                                for(let j=0; j<21; j++) {
                                    fxCtx.moveTo(h1[i].x, h1[i].y);
                                    fxCtx.lineTo(h2[j].x, h2[j].y);
                                }
                            }
                        };
                        drawDarkWiderFiberStrands(fxCtx, crossPath, blendHue, alpha * 0.5); // Use wider, darker strands
                    }
                }
            }
        });
        
        let isProcessing = false;
        async function processVideo() {
            if(!isProcessing && video.videoWidth > 0) {
                isProcessing = true;
                await hands.send({image: video});
                isProcessing = false;
            }
            requestAnimationFrame(processVideo);
        }
        video.onloadedmetadata = () => processVideo();
