/**
 * DEBUG TOOL
 * by Andrea Franchini
 */

(function(){
    function getInfo() {
        var Info = {};
        Info.userAgent = navigator.userAgent;
        Info.platform = navigator.platform;
        Info.date = new Date().getTime();
        Info.height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
        Info.width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        
        Info.description = document.getElementById("cah-issue-tracker-description").value;
        return JSON.stringify(Info);
    }

    function sendMail(to, subject,  body) {
        window.open('mailto:'+to+'?subject='+subject+'&body='+body);
    }

    function createForm() {
        var style = document.createElement("link");
        
        var form = document.createElement("form");
        var title = document.createElement("h3");
        
        var description = document.createElement("textarea");
        var sendButton = document.createElement("button");
        var icon = document.createElement("a");
        
        form.setAttribute("id", "cah-issue-tracker-form");
        description.setAttribute("id", "cah-issue-tracker-description");
        sendButton.setAttribute("id", "cah-issue-tracker-send");
        icon.setAttribute("id", "cah-issue-tracker-icon");
        title.setAttribute("id", "cah-issue-tracker-title");
        title.innerHTML = "Report a bug!"
        description.setAttribute("placeholder", "Please, describe the issue!");
        sendButton.innerHTML = "📧 Send Issue!"
        style.setAttribute("rel", "stylesheet");
        style.setAttribute("href", "css/debug.css");
        form.appendChild(title);
        form.appendChild(description);
        form.appendChild(sendButton);
        form.classList.add("cah-hidden");
        document.head.appendChild(style);
        document.body.appendChild(form);
        document.body.appendChild(icon);
    }

    createForm();

    document.getElementById("cah-issue-tracker-icon").addEventListener("click", function() {
        document.getElementById("cah-issue-tracker-form").classList.toggle("cah-hidden");
    });

    document.getElementById("cah-issue-tracker-send").addEventListener("click", function() {
        sendMail('f.andrea1602@gmail.com', '[CAH ISSUE]', getInfo());
    });
})();