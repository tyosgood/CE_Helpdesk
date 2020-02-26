/*
Macro to create a ticket in ServiceNow when the user clicks a panel button

Load the attached XML file as a UI extension, then customize this macro with your serviceNow info - etc

See the CE API Reference @ https://www.cisco.com/c/en/us/support/collaboration-endpoints/spark-room-kit-series/products-command-reference-list.html

*/


const xapi = require('xapi');


//Enter your ServiceNow info here
const serviceNow_url = "https://dev86077.service-now.com/api/now/table/incident";
const serviceNow_username = 'admin';
const serviceNow_pw = 'C1sco!23';


var SystemName, IP, currentTime, diags, callInfo;


function createticket(event) {
  //make sure the button pressed is the one we want
  if (event.Clicked.PanelId === 'panel_1') {
  
    //Gather diagnostic data and system info
    xapi.config.get('SystemUnit name').then((value) => {SystemName = value; });
    xapi.status.get('time').then((value) => {currentTime = value.SystemTime; });
    xapi.command('diagnostics run').then((value) => {diags = value;});
    xapi.status.get('network ipv4 address').then((value) => {IP = value;});
    callInfo = null;
    
    //determine if the system is in a call and if so gather call data
    xapi.status.get('Call').then((value) => {
      if (Object.entries(value).length !== 0){
        callInfo = JSON.stringify(value, null, 1);
        //unfortunately the below command returns too much data. It causes errors.
        //xapi.status.get('Mediachannels').then((channels) =>{callInfo += JSON.stringify(channels,null,1); console.log(callInfo);});
          
      }
    });
    
    xapi.command("UserInterface Message TextInput Display", {
                                Duration: 0
                              , FeedbackId: "ticket_open"
                              , InputType: "SingleLine"
                              , KeyboardState: "Open"
                              , Placeholder: "Describe Issue Here"
                              , SubmitText: "Submit"
                              , Text: "Please describe your issue"
                              , Title: "Submit Helpdesk Ticket"
                        }).catch((error) => { console.error(error); });
    
    //console.log(event);
  }
}

//fires only after the user submits the info prompt on the screen
xapi.event.on('UserInterface Message TextInput Response', (event) =>{
    if (event.FeedbackId === "ticket_open"){
      var payload;
      //console.log(event.Text);
      
      //create payload of the API call (HTTP Post), add callInfo if gathered
      if (callInfo !== null){
        payload = JSON.stringify(
            { "short_description":"Incident created on Endpoint: "+SystemName+"@ "+currentTime, 
              "comments": "[code]<h2>Customer Comments / Description: \n</h2>[/code]"+event.Text,
              //set higher impact since we are in a call
              "impact": 1,
              "work_notes":
                "[code]<h1>System Info</h1>[/code]"
                +"[code]<h2>System Admin Page: <a href=\"https://"+IP+"\" target=\"_blank\" style=\"color:blue\">http://"+IP+"</a></h2>[/code]\n\n"
                +"[code]<h2>System Diagnostics: \n </h2>[/code]"+JSON.stringify(diags, null, 1)
                +"[code]<h2>Current Call Info: \n </h2>[/code]"+callInfo,
            });
     }
      else{
        payload = JSON.stringify(
            { "short_description":"Incident created on Endpoint: "+SystemName+"@ "+currentTime, 
              "comments": "[code]<h2>Customer Comments / Description: \n</h2>[/code]"+event.Text,
              "impact": 2,
              "work_notes":
                "[code]<h1>System Info</h1>[/code]"
                +"[code]<h2>System Admin Page: <a href=\"https://"+IP+"\" target=\"_blank\" style=\"color:blue\">http://"+IP+"</a></h2>[/code]\n\n"
                +"[code]<h2>System Diagnostics: \n </h2>[/code]"+JSON.stringify(diags, null, 1),
                
            });
      }
      
      //Send the HTTP Post
      xapi.command('HttpClient Post', { 
          Header: ["Content-Type: application/json", 'Authorization: Basic '+encode(serviceNow_username+':'+serviceNow_pw)], 
          Url: serviceNow_url,
          AllowInsecureHTTPS: 'True',
          ResultBody: 'plaintext'
          },
            payload
          )
        //parse API response and display ticket number on the screen
        .then((result) => {
          var resultObj = JSON.parse(result.Body);
          //console.log("success:" + resultObj.result.number);
          xapi.command('UserInterface Message alert Display',{Title:"Ticket Created", text:"Ticket#: "+resultObj.result.number}).catch(e => console.error('Command error '+e));
          
          })
        .catch((err) => {
          console.log("failed: " + JSON.stringify(err));
          }
      );
    }
    
});


//Fire when a custom button is pressed on the endpoint
xapi.event.on('UserInterface Extensions Panel ', createticket);


//Function written by someone else on the internet to do Base64 encoding necessary for Basic Auth
function encode(s) {
  var c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  o = [];
    for (var i = 0, n = s.length; i < n;) {
      var c1 = s.charCodeAt(i++),
      c2 = s.charCodeAt(i++),
      c3 = s.charCodeAt(i++);
      o.push(c.charAt(c1 >> 2));
      o.push(c.charAt(((c1 & 3) << 4) | (c2 >> 4)));
      o.push(c.charAt(i < n + 2 ? ((c2 & 15) << 2) | (c3 >> 6) : 64));
      o.push(c.charAt(i < n + 1 ? c3 & 63 : 64));
    }
  return o.join("");
}
