import * as $talkJquery from 'https://code.jquery.com/jquery-3.6.0.min.js';
import * as talkSignalR from 'https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/3.1.7/signalr.min.js';
import * as talkSelect2 from 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js';

window.$talk = $;
$.noConflict();

var domain = 'https://talk.cognotahealthcare.co.in/'
var api = domain.concat('api/');

$(function () {
    $talk("talk").load("https://satsvelke.github.io/talk/index.html", function () {

        var groups = [];
        var selectedGroup = {};
        var mainCount = 0;

        var elements = {
            chatBadge: $talk(".chat-badge-count"),
            you: ` <div class="chat-group-right d-flex justify-content-end">
                    <div>
                        <div class="chat-panel-img-right">
                            |*initials*|
                        </div>
                        <div class="chat-panel-info-right">
                            <p>|*Text*|</p>
                            <div class="chat-user-info d-flex justify-content-end">
                               
                                <span class="seen-title"><i class="fa-solid fa-check"></i></span>
                            </div>
                        </div>
                    </div>
                </div>`,
            other: ` <div class="chat-group-left d-flex justify-content-start">
                    <div class="">
                        <div class="chat-panel-img-left">
                             |*initials*|
                        </div>
                        <div class="chat-panel-info-left">
                            <p>|*Text*|</p>
                            <div class="chat-user-info d-flex justify-content-between align-items-center">
                                <h6>|*Name*|</h6>
                                <span class="time">|*Date*|</span>
                            </div>
                        </div>
                    </div>
                </div>`,

            fileYouTemplate: `<div  class=" chat-group-right upload-show-UI d-flex justify-content-end">
                    <div id="|*documentid*|" class="document chat-panel-info-right upload-show-info d-flex align-items-center">
                        <span class="file-icon-box"><i class="fa-solid fa-file-image"></i></span>
                        <a class="upload-file-name">|*filename*|</a>
                        <span class="download-icon-box"><i class="fa-solid fa-circle-down"></i></span>
                    </div>
                </div>`,

            fileOtherTemplate: `<div  class=" chat-group-left upload-show-UI d-flex justify-content-start">
                    <div id="|*documentid*|" class=" document chat-panel-info-right upload-show-info d-flex align-items-center">
                        <span class="file-icon-box"><i class="fa-solid fa-file-image"></i></span>
                        <a class="upload-file-name">|*filename*|</a>
                        <span class="download-icon-box"><i class="fa-solid fa-circle-down"></i></span>
                    </div>
                </div>`,

            searchUser: $talk("#search"),
            loggedInUserName: $talk("#logged-in-user-name"),
            talk: $talk("talk"),
            body: $talk("body"),
            selectedTtile: $talk('#selected-title'),
            conversationWindow: $talk(".custom-panel-body"),
            conversations: $talk("#conversations"),
            groupUser: $talk(".group-user"),
            text: $talk("#text"),
            files: $talk('#file'),
            progress: $talk(".chat-upload-progress-bar"),
            otherNameInitials: $talk(".talk-other-name-initials"),
            loggedInInitials: $talk(".talk-loggedin-initials"),
            
        }


        elements.chatBadge.hide();


        const connection = new signalR.HubConnectionBuilder()
            .withUrl(domain.concat("TalkConversationHub?access_token=" + localStorage.getItem('talkToken') + ""))
            .configureLogging(signalR.LogLevel.Information)
            .build();


        elements.searchUser.select2({
            tags: false,
            multiple: false,
            tokenSeparators: [',', ' '],
            minimumInputLength: 3,
            ajax: {
                url: api.concat('user/search'),
                dataType: 'json',
                type: "POST",
                quietMillis: 50,
                contentType: 'application/json',
                headers: {
                    "Authorization": 'Bearer'.concat(' ').concat(localStorage.getItem('talkToken'))
                },
                data: function (params) {
                    var query = { "SearchText": params.term }
                    return JSON.stringify(query);
                },
                processResults: function (data) {
                    return {
                        results: $.map(data.Transaction, function (item) {
                            return {
                                text: item.FirstName.concat(' ').concat(item.LastName),
                                id: item.Id,
                                name: item.FirstName.concat(' ').concat(item.LastName),
                                uniqueId: item.UniqueId
                            }
                        })
                    };
                }
            }
        });

        elements.searchUser.on('select2:select', function (e) {

            let isExist = groups.find(c => c.To == e.params.data.id);

            if (typeof isExist === 'undefined') {
                var request = {
                    method: 'POST',
                    url: api.concat('group/addgroup'),
                    data: { "To": e.params.data.id }
                };

                post(request).then(function (response) {
                    let group = response.Transaction;
                    groups.splice(0, 0, group);
                    selectedGroup = group;

                    let newGroup = [];
                    newGroup.push(group);
                    addToGroups(newGroup);
                    getGroupMessageByUser(scope.selectedGroup.GroupId);
                });
            }
        });

        //=================================================
        //signalr 
        //=================================================

        async function start() {
            try {
                if ('talkToken' in localStorage)
                    await connection.start();
            } catch (err) {
                console.error(err);
                setTimeout(start, 10000);
            }
        };

        connection.onclose(async () => {
            await start();
        });


        //=================================================
        //  singnalr events 
        //==================================================
        connection.on('OnMessageReceived', (message) => {
            message.Date = formatAMPM(new Date(message.TimeStamp));
            showNotification(message);
            if (selectedGroup.ToUniqueId === message.FromUniqueId) {

                if (message.IsDocument) {
                    let documents = []
                    documents.push({ Id: message.DocumentId, Filename: message.DocumentName });
                    addFileChat(getOtherFileTemplate(documents));
                }
                else addChat(elements.other, message);
            }
            else {

                var isexist = groups.find(c => c.GroupId === message.GroupId);

                if (isexist === undefined) {

                    groups.forEach(function (group, index) {
                        group.active = '';
                    });

                    let group = {
                        To: message.From,
                        GroupId: message.GroupId,
                        ToUniqueId: message.FromUniqueId,
                        GroupName: message.GroupName,
                        ProfilePicture: "",
                        IsOnline: true,
                        Count: 1
                    };

                    groups.splice(0, 0, group);
                }
                else {
                    showNotificationCount(message);
                }
            }
        });

        connection.on('OnGroupCreation', (message) => {
            //let scope = angular.element($("#talkContent")).scope();
            //scope.$apply(function () {
            //    let group = scope.groups.find(c => c.To == e.params.data.id);
            //    group.GroupId = message.GroupId
            //    scope.selectedGroup.GroupId = message.GroupId;
            //})
        });

        connection.on("OnConnected", (user) => {
            $talk("#" + user.Id + "-status").removeClass('Away-color-bg');
            $talk("#" + user.Id + "-status").addClass('Available-color-bg');
        });

        connection.on("OnCallerConnected", (user) => {
            let loggedInName = user.FirstName.concat(' ').concat(user.LastName)
            elements.loggedInUserName.html(loggedInName);
            elements.loggedInInitials.html(getInitials(loggedInName))
        });

        connection.on("OnDisConnected", (id) => {
            $talk("#" + id + "-status").removeClass('Available-color-bg')
            $talk("#" + id + "-status").addClass('Away-color-bg')
        });

        start();

        //=================================================
        //signalr 
        //=================================================


        //=================================================
        //  methods 
        //==================================================


        elements.talk.on("click", "#openchat", function (e) {
            elements.body.toggleClass("show");
            elements.chatBadge.html('');
            elements.chatBadge.hide();
            return false;
        });

        var selectGroup = function (group, e) {

            getGroupMessageByUser(group.GroupId);

            groups.forEach(function (group, index) {
                group.active = '';
            });

            $talk(".group-user").removeClass('active');

            $talk("#".concat(group.GroupId)).addClass('active');

            group.active = 'active';
            group.Count = 0;
            selectedGroup = group;

            elements.selectedTtile.html(group.GroupName);
            elements.otherNameInitials.html(getInitials(group.GroupName));
        };


        var post = function (request) {
            $talk.ajaxSetup({
                xhrFields: {
                    responseType: request.responseType
                },
                headers: {
                    'Authorization': 'Bearer '.concat(localStorage.getItem('talkToken'))
                },
                contentType: 'application/json',
            });


            return $talk.post(request.url, JSON.stringify(request.data));
        };

        let addChat = function (template, message) {

            template = template.replace('|*Text*|', message.Text).replace('|*Name*|', message.Name).replace('|*Date*|', message.Date)
                .replace("|*initials*|", message.FromName === undefined ? getInitials(message.Name) : getInitials(message.FromName));
            elements.conversationWindow.append(template);
            elements.conversationWindow.stop().animate({ scrollTop: elements.conversationWindow[0].scrollHeight }, 1000);
        }

        let addFileChat = function (template, message) {
            elements.conversationWindow.append(template);
            elements.conversationWindow.stop().animate({ scrollTop: elements.conversationWindow[0].scrollHeight }, 1000);
        }


        var createGroup = function () {
            //  connection.invoke('AddToGroup', '13456');
        };

        var showNotificationCount = function (message) {
            let index = groups.findIndex((x => x.ToUniqueId == message.FromUniqueId));
            let count = groups[index].Count = parseInt(groups[index].Count === undefined || groups[index].Count === '' ? 0 : groups[index].Count) + 1
            $talk("#".concat(message.GroupId).concat('-count')).html(count);
            $talk("#".concat(message.GroupId).concat('-count')).show();
        };

        var getInitials = function (name) {
            return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase()
        }

        let uuidv4 = function () {
            return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
                (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            );
        };

        function formatAMPM(date) {
            var hours = date.getHours();
            var minutes = date.getMinutes();
            var ampm = hours >= 12 ? 'pm' : 'am';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            minutes = minutes < 10 ? '0' + minutes : minutes;
            var strTime = hours + ':' + minutes + ' ' + ampm;
            return strTime;
        }

        function ignoreerror() {
            return true
        }

        window.onerror = ignoreerror();

        //=================================================
        //  methods 
        //==================================================



        //=================================================
        //  events 
        //==================================================
        elements.talk.on("click", ".group-user", function (e) {

            let groupId = $talk(this).attr("id");
            elements.groupUser.removeClass('active');
            $talk(this).addClass('active');
            var group = groups.find(x => x.GroupId === groupId);

            $talk("#".concat(group.GroupId).concat('-count')).html('');
            $talk("#".concat(group.GroupId).concat('-count')).hide();

            selectGroup(group);
        });

        var showNotification = function (message) {

            if (elements.body.hasClass('show')) {
                return false;
            }

            mainCount = mainCount + 1;
            elements.chatBadge.html(mainCount);
            elements.chatBadge.show();
        };


        var addToGroups = function (groups) {
            const groupTemplate = groups.map(item => {

                item.Date === undefined ? item.Date = '' : item.Date;
                item.Count === undefined || item.Count === 0 ? item.Count = '' : item.Count;

                return `<div id='${item['GroupId']}'" 
                                                 class="group-user chat-contact-list ${item['active']}">
                                                <div class="image-chat-wrapper">
                                                    <div class="chat-img">
                                                          ${getInitials(item['GroupName'])}
                                                    </div>
                                                    <span id='${item['To']}-status'"
                                                    class="signal-status status-round  ${item.IsOnline === true ? 'Available-color-bg' : 'Away-color-bg'} ">
                                                    </span>
                                                </div>
                                                <div class="chat-info">
                                                    <div class="d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <h5>${item['GroupName']}</h5>
                                                            <p>
                                                            </p>
                                                        </div>
                                                        <div class="chat-menu-icons">
                                                            <span class="time">${item['Date']}</span>
                                                            <div class="d-flex justify-content-end">
                                                                <span style="display: ${item.Count === '' ? 'none' : 'block'}"  id="${item['GroupId']}-count" class="chat-badge">${item['Count']}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>` ;
            });

            elements.conversations.append(groupTemplate);
        }

        elements.talk.on("keyup", "#text", function ($event) {
            if (!elements.text.val())
                return;

            if ($event.keyCode === 13) {
                sendMessage();
            }
        });

        elements.talk.on("click", "#sendMessage", function (e) {
            sendMessage();
        });

        var sendMessage = function (event) {

            if (elements.text.val() === undefined) {
                alert('type something');
                return;
            }
            else {
                let users = [];
                users.push(selectedGroup.To);
                
                let message = {
                    To: selectedGroup.To,
                    ToUniqueId: selectedGroup.ToUniqueId,
                    Name: selectedGroup.GroupName,
                    Text: elements.text.val(),
                    Users: users,
                    GroupId: selectedGroup.GroupId,
                    TimeStamp: parseInt(Date.now()),
                    FromName: elements.loggedInUserName.html()
                };

                connection.invoke('Send', message);

                addChat(elements.you, message);

                elements.text.val('')
            }
        };

        var getGroups = function () {

            var request = {
                method: 'POST',
                url: api.concat('group/getgroups'),
                data: {}
            };

            post(request).then(function (response) {
                groups = response.Transaction;

                if (groups.length > 0) {
                    let group = groups[0];
                    group.active = 'active'
                    selectGroup(group, 'load');
                    addToGroups(groups);
                }

            }, function () { });
        };

        var getGroupMessageByUser = function (groupId) {

            var request = {
                method: 'POST',
                url: api.concat('message/getmessagebyuser'),
                data: { "GroupId": groupId }
            };

            post(request).then(function (response) {

                elements.conversationWindow.html('');

                response.Transaction.forEach(function (message, index) {
                    message.Date = formatAMPM(new Date(message.TimeStamp));
                    if (message.IsLeft) {
                        if (message.IsDocument) {
                            let documents = [];
                            documents.push({ Id: message.DocumentId, Filename: message.DocumentName });
                            addFileChat(getOtherFileTemplate(documents));
                        }
                        else {
                            addChat(elements.other, message);
                        }
                    }
                    else {

                        if (message.IsDocument) {
                            let documents = [];
                            documents.push({ Id: message.DocumentId, Filename: message.DocumentName });
                            addFileChat(getYouFileTemplate(documents));
                        }
                        else {
                            addChat(elements.you, message);
                        }

                    }
                });

            }, function () { });
        };



        var getYouFileTemplate = function (documents) {
            var template = documents.map(c => {
                return elements.fileYouTemplate
                    .replace("|*filename*|", c.Filename)
                    .replace("|*documentid*|", c.Id);
            });

            return template;
        }

        var getOtherFileTemplate = function (documents) {
            var template = documents.map(c => {
                return elements.fileOtherTemplate
                    .replace("|*filename*|", c.Filename)
                    .replace("|*documentid*|", c.Id);
            });

            return template;
        }

        var sendUploadedMessage = function (documents) {

            let users = [];
            users.push(selectedGroup.To);

            documents.forEach(function (document) {
                let message = {
                    To: selectedGroup.To,
                    ToUniqueId: selectedGroup.ToUniqueId,
                    Name: selectedGroup.GroupName,
                    Text: elements.text.val(),
                    Users: users,
                    GroupId: selectedGroup.GroupId,
                    TimeStamp: parseInt(Date.now()),
                    IsDocument: true,
                    DocumentId: document.Id,
                    DocumentName: document.Filename
                };

                connection.invoke('Send', message);
            });

            addFileChat(getYouFileTemplate(documents));

            elements.text.val('')
        };

        function removeFiles(e) {
            elements.files.val('');
        }

        elements.talk.on("click", "#file", function ($event) {
            removeFiles();
        });

        elements.talk.on("click", ".document", function ($event) {
            var request = {
                method: 'POST',
                url: api.concat('document/getbyid'),
                data: { Id: this.id },
                responseType: 'blob'
            };

            post(request).then(function (response, status, xhr) {
                var filename = "";
                var disposition = xhr.getResponseHeader('Content-Disposition');
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    var matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
                }


                const url = window.URL.createObjectURL(new Blob([response]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();

            });

        });

        elements.talk.on("change", "#file", function ($event) {

            var formData = new FormData($('form')[0]);

            if (this.files.length > 0) {
                for (var i = 0; i < this.files.length; i++) {
                    formData.append('files', this.files[i]);
                }

                $talk.ajax({
                    url: api.concat('document/upload'),
                    type: 'POST',
                    data: formData,
                    cache: false,
                    contentType: false,
                    processData: false,
                    headers: {
                        "Authorization": "Bearer " + localStorage.getItem('talkToken')
                    },
                    xhr: function () {
                        var myXhr = $talk.ajaxSettings.xhr();
                        if (myXhr.upload) {
                            myXhr.upload.addEventListener('progress', function (e) {
                                if (e.lengthComputable) {
                                    let percent = (e.loaded / e.total) * 100;
                                    elements.progress.show();
                                    elements.progress.css("width", percent + '%');
                                }
                            }, false);
                        }
                        return myXhr;
                    }
                }).done(function (response) {
                    elements.progress.hide();
                    elements.progress.css("width", '0%');
                    sendUploadedMessage(response.Transaction);
                    removeFiles();
                }).fail(function (response) {
                    console.error(response.statusText);
                    elements.progress.hide();
                    elements.progress.css("width", '0%');
                    removeFiles();
                });
            }
        });

        //=================================================
        //  methods 
        //==================================================

        getGroups();

    });
});
