const Discord = require("discord.js");
const client = new Discord.Client();

var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');

global.appRoot = path.resolve(__dirname);
var servers = {};
var groupCommands = {};
var grouplessCommands = {};
var runningSessions = new Array();

function generateSessionID() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 10; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}


class Server {
    constructor(_guildObj) {
        this.guildObj = _guildObj;

        this.id = _guildObj.id;
        this.name = _guildObj.name;
        this.prefix = "&";
        this.mentorDict = {};

        fs.stat(appRoot + "/serverconfig/" + this.id.toString() + ".txt", function (err, stat) {
            if (err == null) {
                fs.readFile(appRoot + "/serverconfig/" + this.id.toString() + ".txt", 'utf8', function (_err, data) {
                    if (_err)
                        console.log("Server load error! ", _err.code);
                    else {
                        var fileParts = data.split("\r\n");
                        this.prefix = fileParts[0];
                    }
                }.bind(this));
            }
            else if (err.code == 'ENOENT') {
                mkdirp(`${appRoot}/serverconfig/${this.id.toString()}/`);
                fs.writeFile(appRoot + "/serverconfig/" + this.id.toString() + "/config.txt", "&\r\n", (err_) => { if (err_) console.log("Server write error! ", err_.code); });
            }
            else {
                console.log("Server save error! ", err.code);
            }
        }.bind(this));

        fs.readdir(`${appRoot}/serverconfig/${this.id.toString()}/mentors/`, (err, storedTopics) => {
            if (storedTopics !== undefined) {
                storedTopics.forEach(file => {
                    fs.readFile(`${appRoot}/serverconfig/${this.id.toString()}/mentors/${file}`, 'utf8', (_err, data) => {
                        var lines = data.split("\r\n");
                        lines.forEach((line) => {
                            var str = line.match(/([^\n\r\t ])/g);
                            if (str != null)
                            {
                                this.addMemberToMentorTopic(line, file.substring(0, file.length - 4));
                            }
                        });
                    });
                });
            }
        });
    }

    addMemberToMentorTopic(_memberID, _topicName, _msg)
    {
        if (!this.mentorDict[_topicName.toLowerCase()])
            this.mentorDict[_topicName.toLowerCase()] = { mentorIDs: [] };

        if (this.mentorDict[_topicName.toLowerCase()].mentorIDs.indexOf(_memberID) != -1) {
            if (_msg != undefined)
                send(_msg, "Already mentor", `The user <@${_memberID}> already is a ${_topicName} mentor!`)
            return;
        }
        else {
            this.mentorDict[_topicName.toLowerCase()].mentorIDs.push(_memberID.toString());
            if (_msg != undefined)
                send(_msg, `Added mentor`, `Added the user <@${_memberID}> to the ${_topicName} mentors!`);
        }

        var toWrite = "";
        this.mentorDict[_topicName.toLowerCase()].mentorIDs.forEach(function (_id) {
            toWrite += _id + "\r\n";
        });

        mkdirp(`${appRoot}/serverconfig/${this.id.toString()}/mentors/`);
        fs.writeFile(`${appRoot}/serverconfig/${this.id.toString()}/mentors/${_topicName}.txt`, toWrite, (err) => { if (err) console.log("Mentor write error! ", err.code); });
    }

    removeMemberFromMentorTopic(_memberID, _topicName, _msg)
    {
        if (!this.mentorDict[_topicName.toLowerCase()]) {
            send(_msg, "Empty topic", `The topic ${_topicName} does not contain any mentors!`);
            return;
        }

        var index = this.mentorDict[_topicName.toLowerCase()].mentorIDs.indexOf(_memberID);
        if (index != -1)
        {
            this.mentorDict[_topicName.toLowerCase()].mentorIDs.splice(index, 1);

            send(_msg, "Removed mentor", `Removed the user <@${_memberID}> from the ${_topicName} mentors!`);

            var toWrite = "";
            this.mentorDict[_topicName.toLowerCase()].mentorIDs.forEach(function (_id) {
                toWrite += _id + "\r\n";
            });

            if (toWrite.length < 15)
            {
                delete this.mentorDict[_topicName.toLowerCase()];
                fs.unlink(`${appRoot}/serverconfig/${this.id.toString()}/mentors/${_topicName}.txt`, (err) => { if (err) console.log("Mentor deletion error! ", err.code); });
            }
            else
            {
                fs.writeFile(`${appRoot}/serverconfig/${this.id.toString()}/mentors/${_topicName}.txt`, toWrite, (err) => { if (err) console.log("Mentor write error! ", err.code); });
            }
        }
        else
        {
            send(_msg, "Not part of mentors", `The user you provided is not part of the ${_topicName} mentors!`)
        }

    }
}

class Command {
    constructor(_group, _command, _minParams, _function) {
        this.group = _group;
        this.command = _command;
        this.minParams = _minParams;
        this.func = _function;

        if (this.group !== undefined && this.group !== "") {
            if (!groupCommands[this.group])
                groupCommands[this.group] = { commands: {} };

            groupCommands[this.group].commands[this.command] = this;
        }
        else {
            this.group = "";
            grouplessCommands[this.command] = this;
        }
    }

    execute(_msg, _params) {
        if (_params !== undefined) {
            if (_params.length >= this.minParams)
                this.func(_msg, _params);
            else
                send(_msg, "Not enough arguments", `The command **${this.command}**${this.group !== "" ? " in the group " + this.group : ""} can only be executed with ${this.minParams} or more arguments!`);
        } else {
            if (this.minParams === 0)
                this.func(_msg, _params);
            else
                send(_msg, "Not enough arguments", `The command **${this.command}**${this.group !== "" ? " in the group " + this.group : ""} can only be executed with ${this.minParams} or more arguments!`);
        }
    }
}

class Session {
    constructor(_mentor, _student, _sessionID, _serverID) {
        if (_sessionID === undefined) {
            this.mentor = _mentor;
            this.sessionID = ("Session-" + generateSessionID()).toLowerCase();
            this.server = _mentor.guild;

            mkdirp(`${appRoot}/serverconfig/${this.server.id.toString()}/sessions/`);
            fs.writeFile(appRoot + "/serverconfig/" + _mentor.guild.id + "/sessions/" + this.sessionID + ".txt", this.mentor.id, { flag: 'wx' }, function (err) { });

            _mentor.guild.createChannel(this.sessionID, "text").then(function (channel)
            {
                channel.overwritePermissions(_mentor.guild.id, { SEND_MESSAGES: false, READ_MESSAGES: false });
                channel.overwritePermissions(_mentor, { SEND_MESSAGES: true, READ_MESSAGES: true });
                channel.overwritePermissions(_student, { SEND_MESSAGES: true, READ_MESSAGES: true });
                channel.send("Use the command `" + servers[channel.guild.id].prefix + "endsession` to end this session or `" + servers[channel.guild.id].prefix + " [mention] to invite a member!");
            }.bind(this));
        } else {
            this.sessionID = _sessionID;
            this.server = client.guilds.get(_serverID);

            var fname = _sessionID + ".txt";

            var filec = fs.readFileSync(appRoot + '/serverconfig/' + _serverID + '/sessions/' + fname, 'utf8');
            var lines = filec.split("\r\n");

            lines.forEach(function (line) {
                var parts = line.split(" ");
                var menID = parts[0];

                this.mentor = client.guilds.get(_serverID).members.get(menID);
            }.bind(this));
        }
    }

    endSession() {
        fs.unlink(appRoot + '/serverconfig/' + this.serverID + '/sessions/' + this.sessionID + ".txt", () => { })
    }

    sendMessage(_str) {
        this.server.channels.forEach(function (c) {
            if (c.name === this.sessionID) {
                c.send(_str);
            }
        }.bind(this));
    }

    addMember(_member) {
        this.server.channels.forEach(function (c) {
            if (c.name === this.sessionID) {
                c.overwritePermissions(_member, { SEND_MESSAGES: true, READ_MESSAGES: true });
            }
        }.bind(this));
    }
}


async function MentorAddCommand(_msg, _params)
{
    var execute = true;

    _msg.member.roles.forEach(function (role, key) {
        if (role.name === "Administrator" || role.name === "Head Administrator" || role.name === "Global Director" || role.name === "Moderator" || role.name === "Staff") {
            if (execute) {
                execute = false;

                var topic = _params[0];
                var userID = _params[1];

                if (/(<@[0-9]{18}>)|(<@![0-9]{18}>)/g.test(userID)) {
                    userID = userID.replace(/[<@!>]/g, "");

                    if (!_msg.guild.members.get(userID)) {
                        send(_msg, "Invalid user", "The user you provided is not valid!");
                        return;
                    }

                    servers[_msg.guild.id].addMemberToMentorTopic(userID, topic, _msg);
                }
                else {
                    send(_msg, "Invalid user", "You have to mention a user!");
                    return;
                }
            }
        }
    }.bind(execute));
}

async function MentorRemoveCommand(_msg, _params)
{
    var execute = true;

    _msg.member.roles.forEach(function (role, key) {
        if (role.name === "Administrator" || role.name === "Head Administrator" || role.name === "Global Director" || role.name === "Moderator" || role.name === "Staff") {
            if (execute) {
                execute = false;
                var topic = _params[0];
                var userID = _params[1];

                if (/(<@[0-9]{18}>)|(<@![0-9]{18}>)/g.test(userID)) {
                    userID = userID.replace(/[<@!>]/g, "");

                    if (!_msg.guild.members.get(userID)) {
                        send(_msg, "Invalid user", "The user you provided is not valid!");
                        return;
                    }

                    servers[_msg.guild.id].removeMemberFromMentorTopic(userID, topic, _msg);
                }
                else {
                    send(_msg, "Invalid user", "You have to mention a user!");
                    return;
                }
            }
        }
    }.bind(execute));
}

async function MentorListCommand(_msg, _params)
{
    var msgs = new Array();

    var fullMessage = "";
    var pushAgain = false;

    for (var key in servers[_msg.guild.id].mentorDict)
    {
        if (key in servers[_msg.guild.id].mentorDict) {
            fullMessage += "**" + key + "**\n";

            for (var i = 0; i < servers[_msg.guild.id].mentorDict[key].mentorIDs.length; i++) {
                fullMessage += "\t" + _msg.guild.members.get(servers[_msg.guild.id].mentorDict[key].mentorIDs[i]).user.username + "\n";
            }

            pushAgain = true;

            if (fullMessage.length + 500 > 2000) {
                msgs.push(fullMessage);
                fullMessage = "";
                pushAgain = false;
            }

            fullMessage += "\n";
        }
    }

    if (pushAgain)
        msgs.push(fullMessage);

    for (var i = 0; i < msgs.length; i++)
    {
        send(_msg, "Mentors page " + (i + 1).toString(), msgs[i]);
    }
}

async function EndSessionCommand(_msg, _params)
{
    if (_msg.channel.name.substring(0, 7) == "session")
    {
        _msg.guild.channels.get(_msg.channel.id).delete();
    }
}

async function RequestMentorCommand(_msg, _params)
{
    var found = false;

    var stringToSend = `\n\nThe user <@${_msg.member.id}> requested a **${_params.join(" ")}** mentor! Click the white checkmark to accept.`;

    if (servers[_msg.guild.id].mentorDict[_params.join(" ").toLowerCase()])
    {
        if (servers[_msg.guild.id].mentorDict[_params.join(" ").toLowerCase()].mentorIDs.length > 0)
        {
            for (var i = 0; i < servers[_msg.guild.id].mentorDict[_params.join(" ").toLowerCase()].mentorIDs.length; i++) {
                var stringToAdd = "<@!" + servers[_msg.guild.id].mentorDict[_params.join(" ").toLowerCase()].mentorIDs[i] + ">";
                stringToSend = stringToAdd + stringToSend;
            }

            _msg.member.send(`Sent your request for a ${_params.join(" ")} mentor!`);
            servers[_msg.guild.id].requestChannel.send(stringToSend).then(function (sentMsg) { sentMsg.react("✅"); });
        }
    }
    else
    {
        _msg.member.send(`Sent your request for a ${_params.join(" ")} mentor!`);
        servers[_msg.guild.id].requestChannel.send(stringToSend).then(function (sentMsg) { sentMsg.react("✅"); });
    }
}

async function InviteCommand(_msg, _params)
{
    var userID = _params[0];

    if (/(<@[0-9]{18}>)|(<@![0-9]{18}>)/g.test(userID)) {
        userID = userID.replace(/[<@!>]/g, "");

        if (!_msg.guild.members.get(userID)) {
            send(_msg, "Invalid user", "The user you provided is not valid!");
            return;
        }

        _msg.guild.members.get(userID).send(`<@${_msg.member.id}> invited you to join ${_msg.channel.name}! Click the white checkmark to accept.`).then(function (sentMsg) { sentMsg.react("✅"); });
    }
}

async function CommandDownForMaintenance(_msg, _params)
{
    send(_msg, "Down for maintenance", "The command you provided is down for maintenance right now!");
}


async function send(_msg, _title, _str) {
    var embed = new Discord.RichEmbed().setTitle(_title).setDescription(_str).setColor([0, 18, 68]).setTimestamp().setFooter("Executed by " + _msg.member.displayName, _msg.member.user.avatarURL);
    _msg.channel.send({ embed });
}

function getParts(_msgString) {
    var inBrackets = false;
    var rightAfterBrackets = false;

    var currentPart = "";

    var parts = new Array();

    for (i = 0; i < _msgString.length; i++) {
        if (_msgString[i] === "[" && !inBrackets) {
            inBrackets = true;
            continue;
        } else if (_msgString[i] === "]" && inBrackets) {
            inBrackets = false;
            parts.push(currentPart);
            currentPart = "";
            rightAfterBrackets = true;
            continue;
        }

        if (rightAfterBrackets && !inBrackets) {
            if (_msgString[i] === " " || _msgString[i] === "[") {
                rightAfterBrackets = false;
                continue;
            }
        } else if (!rightAfterBrackets && !inBrackets) {
            if (_msgString[i] === " ") {
                parts.push(currentPart);
                currentPart = "";
                continue;
            }
        }

        currentPart += _msgString[i];
    }

    parts.push(currentPart);

    return parts;
}

client.on("messageReactionAdd", async function (_react, _user) {
    if (_react.message.author.id !== client.user.id)
        return;
    if (_user.id === client.user.id)
        return;
    if (_react.emoji.name !== "✅")
        return;

    var msg = _react.message;
    var content = msg.toString();

    if (_react.message.channel.type === "dm")
    {
        var sessionName = content.split(" ")[5];
        sessionName = sessionName.substring(0, sessionName.length - 1);

        var doIt = true;
        runningSessions.forEach(function (sess) {
            if (sess.sessionID == sessionName) {
                sess.addMember(_user);
                sess.sendMessage(`<@${_user.id}> accepted your invitation!`);
            }
        }.bind(sessionName));
    }
    else if (_react.message.channel.name === "mentor-requests")
    {
        var topicName = content.substring(content.indexOf("**") + 2, content.lastIndexOf("**"));
        var requesterID = content.substring(content.lastIndexOf("<") + 1, content.lastIndexOf(">"));
        if (requesterID[0] === "@")
            requesterID = requesterID.substring(1, requesterID.length);
        if (requesterID[0] === "!")
            requesterID = requesterID.substring(1, requesterID.length);

        var requester = msg.guild.members.get(requesterID);

        if (requesterID === _user.id)
            return;
        if (content[0] === "~")
            return;

        if (!(topicName.toLowerCase() in servers[msg.guild.id].mentorDict)) {
            runningSessions.push(new Session(msg.guild.members.get(_user.id), requester));
            requester.send(`Your request for a ${topicName} mentor has been accepted by ${_user.username}!`);
            msg.edit("~~" + content + "~~");
        }
        else {
            if (servers[msg.guild.id].mentorDict[topicName.toLowerCase()].mentorIDs.includes(_user.id)) {
                runningSessions.push(new Session(msg.guild.members.get(_user.id), requester));
                requester.send(`Your request for a ${topicName} mentor has been accepted by ${_user.username}!`);
                msg.edit("~~" + content + "~~" + "  accepted by " + _user.username);
            }
        }
    }
});

client.on('message', async message => {
    if (message.channel.type === "dm")
        return;
    if (message.member.user.bot !== false || servers[message.guild.id].prefix !== message.toString().substring(0, servers[message.guild.id].prefix.length))
        return;

    var msgString = message.toString().substring(1, message.toString().length);
    var msgParts = getParts(msgString);

    if (msgParts[0].toLowerCase() in groupCommands) {
        var group = msgParts[0].toLowerCase();

        if (msgParts[1].toLowerCase() in groupCommands[group].commands) {
            var command = msgParts[0].toLowerCase();
            var params = msgParts.splice(2, msgParts.length);

            groupCommands[msgParts[0].toLowerCase()].commands[msgParts[1].toLowerCase()].execute(message, params);
        }
        else {
            send(message, "Invalid command", `The command **${msgParts[1]}** does not exist in the group ${msgParts[0]}!`);
        }
    }
    else {
        if (msgParts[0].toLowerCase() in grouplessCommands) {
            var params = msgParts.splice(1, msgParts.length);
            grouplessCommands[msgParts[0].toLowerCase()].execute(message, params);
        }
        else {
            send(message, "Invalid command", `The command **${msgParts[0]}** does not exist!`);
        }
    }
});

client.on('guildCreate', guildObj => {
    servers[guildObj.id.toString()] = new Server(guildObj);
});

client.on('ready', () => {
    client.user.setGame("&requestmentor");

    client.guilds.forEach(function (_guildObj, _key) {
        var foundRequestChannel = false;

        servers[_key.toString()] = new Server(_guildObj);

        _guildObj.channels.forEach(function (chanObj, key) {
            if (chanObj.name.toLowerCase() === "mentor-requests") {
                servers[_key.toString()].requestChannel = chanObj;
                foundRequestChannel = true;
            }
        });

        if (foundRequestChannel === false) {
            _guildObj.createChannel("mentor-requests", "text").then(function (channel) { channel.overwritePermissions(_guildObj.id, { SEND_MESSAGES: false }); servers[_key.toString()].requestChannel = channel; }.bind(_guildObj));
        }
    });

    fs.readdirSync(`${appRoot}/serverconfig/`).forEach(folder => {
        if (fs.existsSync(`${appRoot}/serverconfig/${folder}/sessions/`)) {
            fs.readdirSync(`${appRoot}/serverconfig/${folder}/sessions/`).forEach(file => {
                var fContent = fs.readFileSync(`${appRoot}/serverconfig/${folder}/sessions/${file}`, 'utf8');
                runningSessions.push(new Session(client.guilds.get(folder).members.get(fContent), null, file.substring(0, file.length - 4), client.guilds.get(folder).id));
            });
        }
    });

    new Command("mentor", "add", 2, MentorAddCommand);
    new Command("mentor", "remove", 2, MentorRemoveCommand);
    new Command("mentor", "list", 0, MentorListCommand);
    new Command("", "requestmentor", 1, RequestMentorCommand);
    new Command("", "invite", 1, InviteCommand);
    new Command("", "endsession", 0, EndSessionCommand);
    new Command("", "help", 0, CommandDownForMaintenance);
});

client.login(process.argv.splice(2)[0]);