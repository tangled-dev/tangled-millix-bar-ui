**uncomment this millix_bar.html:226<br>**
<iframe id="frame_millix_api" src="./millix_ws.html" class="hidden-element"
onload="millix_bar.onApiFrameReady()"></iframe>

**comment this millix_bar.html:227<br>**
<iframe id="frame_millix_api" src="chrome-untrusted://millix-ws/" class="hidden-element"
onload="millix_bar.onApiFrameReady()"></iframe>
****
**comment millix_ws.js:6<br>**
static PARENT_FRAME_ID = 'tangled://millix-bar';
**<br>uncomment millix_ws.js:8<br>**
static PARENT_FRAME_ID = '*';
****
**uncomment millix_bar.js:4 - millix_bar.js:36<br>**
add values to NODE_ID (millix_bar.js:18) and NODE_SIGNATURE (millix_bar.js:19)

