var Discord = require('discord.js');
var client = new Discord.Client();
var fs = require('fs');
var path = require('path');
global.appRoot = path.resolve(__dirname);

prefix = "";

var guild;
var openRequests = {};
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
    constructor(_mentor, _student, _sessionID) {
        if (_sessionID === undefined) {
            this.student = _student;
            this.mentor = _mentor;
            this.sessionID = ("Session-" + getSessionID()).toLowerCase();

            var str = this.student.id + " " + this.mentor.id;
            fs.writeFile(appRoot + "/sessions/" + this.sessionID + ".txt", str, { flag: 'wx' }, function (err) { });

            _mentor.guild.createChannel(this.sessionID, "text").then(function (channel) { channel.overwritePermissions(_mentor.guild.id, { SEND_MESSAGES: false, READ_MESSAGES: false }); channel.overwritePermissions(_mentor, { SEND_MESSAGES: true, READ_MESSAGES: true }); channel.overwritePermissions(_student, { SEND_MESSAGES: true, READ_MESSAGES: true }); channel.send("Use the command `" + prefix + "endsession` when you are finished!"); });
        } else {
            this.sessionID = _sessionID;

            var fname = _sessionID + ".txt";

            var filec = fs.readFileSync(appRoot + '/sessions/' + fname, 'utf8');
            var lines = filec.split("\r\n");

            lines.forEach(function (line) {
                var parts = line.split(" ");
                var stuID = parts[0];
                var menID = parts[1];

                guild.members.forEach(function (us) {
                    if (us.id === stuID) {
                        this.student = us;
                    } else if (us.id === menID) {
                        this.mentor = us;
                    }
                }.bind(this));
            }.bind(this));
        }
    }

    endSession() {
        guild.channels.forEach(function (c) {
            if (c.name === this.sessionID) {
                c.delete();
            }
        }.bind(this));

        fs.unlink(appRoot + '/sessions/' + this.sessionID + ".txt", () => { })
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
                var requestType = "";
                for (i = 0; i < params.length; i++) {
                    requestType += params[i] + " ";
                }
                requestType = requestType.substring(0, requestType.length - 1);

                message.guild.roles.forEach(function (rol) {
                    if (rol.name.length > 6) {
                        if (rol.name.substring(0, rol.name.length - 7).toLowerCase() === requestType.toLowerCase()) {
                            message.guild.channels.forEach(function (channel) {
                                if (channel.name === "mentors") {
                                    channel.send("<@&" + rol.id + ">" + ", The user <@" + message.author.id + "> requested a **" + requestType + "** mentor!").then(function (sm) { sm.react("✅"); openRequests[sm.id] = message; });
                                    message.member.send("Sent your request!");
                                }
                            });
                        }
                    }
                });
            }
        } else if (command === "endsession") {
            runningSession.forEach(function (s) {
                if (s.sessionID === message.channel.name) {
                    s.endSession();
                }
            });
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
            openRequests[msg.message.id].member.send("Your request was accepted!");

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

    client.guilds.forEach(async (g) => {
        guild = g;
    });

    fs.readdirSync(appRoot + "/sessions/").forEach(file => {
        runningSession.push(new Session("", "", file.substring(0, file.length - 4)));
    });

    prefix = lines[0];
});

client.login(process.argv[2]);