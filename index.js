var Discord = require('discord.js');
var client = new Discord.Client();
var fs = require('fs');
var path = require('path');
global.appRoot = path.resolve(__dirname);

prefix = "";

var openRequests = {};
var availableLangs = new Array();
var availableTopics = new Array();
var runningSession = new Array();

function getSessionID() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 10; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}

class Session
{
    constructor(_mentor, _student) {
        this.student = _student;
        this.mentor = _mentor;
        this.sessionID = ("Session-" + getSessionID()).toLowerCase();

        _mentor.guild.createChannel(this.sessionID, "text").then(function (channel) { channel.overwritePermissions(_mentor.guild.id, { SEND_MESSAGES: false, READ_MESSAGES: false }); channel.overwritePermissions(_mentor, { SEND_MESSAGES: true, READ_MESSAGES: true }); channel.overwritePermissions(_student, { SEND_MESSAGES: true, READ_MESSAGES: true }); channel.send("Use the command `" + prefix + "endsession` when you are finished!"); });
    }

    endSession() {
        this.mentor.guild.channels.forEach(function (c) {
            if (c.name === this.sessionID) {
                c.delete();
            }
        }.bind(this));
    }
}

client.on('message', async (message) => {
    if (message.toString().toLowerCase().substring(0, 1) === prefix) {
        var parts = message.toString().replace(/(\r\n|\n|\r)/gm, "").split(" ");

        var command = parts[0].substring(prefix.length, parts[0].length);
        var params = parts.slice(1, parts.length);

        if (command === "setprefix") {
            if (message.member.hasPermission("ADMINISTRATOR")) {
                if (params.length > 0) {
                    prefix = params[0];

                    fs.writeFile(appRoot + '/prefix.txt', params[0], function (err) {

                    });

                    var everyoneRole = message.guild.roles.find('name', '@everyone')

                    message.channel.send(everyoneRole.toString() + ", This server now uses the prefix \"***" + params[0] + "***\" for commands!");
                }
                else {
                    message.reply("This command can't be called without a parameter!");
                }
            }
        } else if (command === "requestmentor") {
            if (params.length > 0) {
                if (availableLangs.includes(params[0].toLowerCase())) {
                    message.guild.channels.forEach(function (channel) {
                        if (channel.name === "mentors") {
                            channel.send("The user " + message.author.username + " requested a **" + params[0] + "** mentor!").then(function (sm) { sm.react("✅"); openRequests[sm.id] = message; });
                        }
                    });
                }
            }
        } else if (command === "endsession") {
            runningSession.forEach(function (s) {
                if (s.sessionID === message.channel.name) {
                    s.endSession();
                }
            });
        } else if (command === "addlang") {
            var allowed = false;

            if (allowed || message.member.hasPermission("ADMINISTRATOR")) {
                if (params.length > 0) {
                    if (!availableLangs.includes(params[0].toLowerCase())) {
                        availableLangs.push(params[0]);

                        var filec = fs.readFileSync(appRoot + '/languages.txt', 'utf8');
                        var lines = filec.split("\r\n");

                        var fileparts = new Array();
                        for (i = 0; i < lines.length; i++) {
                            var p = lines[i].toString().toLowerCase().split(" ");
                            fileparts.push(p);
                        }

                        var str = "";
                        for (i = 0; i < availableLangs.length; i++) {
                            str += availableLangs[i] + "\r\n";
                        }
                        fs.writeFile(appRoot + '/languages.txt', str, function (err) {

                        });
                    }
                }
            }
        } else if (command === "listlangs") {
            var str = "The languages the bot knows of are:\n`";
            availableLangs.forEach(function (lang) {
                str += lang + "\n";
            });
            str += "`";

            message.reply(str);
        }
    }
});

client.on("messageReactionAdd", async (msg) => {
    if (openRequests[msg.message.id] !== undefined) {
        if (msg.users.size > 1) {
            var men;

            for (var [key, value] of msg.users) {
                men = value;
            }

            msg.message.edit("~~" + msg.message.content + "~~" + "   accepted by " + men);
            msg.message.clearReactions();

            openRequests[msg.message.id].react("✅");

            var mentorMember = msg.message.guild.member(men);

            var session = new Session(mentorMember, openRequests[msg.message.id].member);
            runningSession.push(session);

            openRequests[msg.message.id] = undefined;
        }
    }
});

client.on("ready", async () => {
    var filec = fs.readFileSync(appRoot + '/prefix.txt', 'utf8');
    var lines = filec.split("\r\n");

    prefix = lines[0];

    filec = fs.readFileSync(appRoot + '/languages.txt', 'utf8');
    lines = filec.split("\r\n");

    for (i = 0; i < lines.length; i++) {
        availableLangs.push(lines[i]);
    }
});

client.login(process.argv[2]);