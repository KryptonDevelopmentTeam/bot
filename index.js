var Discord = require('discord.js');
var client = new Discord.Client();
var fs = require('fs');
var path = require('path');
global.appRoot = path.resolve(__dirname);

prefix = "";

var guild;
var topicAliases = {};
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

function getParams(_str) {
    var inBrackets = false;
    var rightAfterBrackets = false;

    var currentParam = "";

    var params = new Array();

    for (i = 0; i < _str.length; i++) {
        if (_str[i] === "[" && !inBrackets) {
            inBrackets = true;
            continue;
        } else if (_str[i] === "]" && inBrackets) {
            inBrackets = false;
            params.push(currentParam);
            currentParam = "";
            rightAfterBrackets = true;
            continue;
        }

        if (rightAfterBrackets && !inBrackets) {
            if (_str[i] === " " || _str[i] === "[") {
                rightAfterBrackets = false;
                continue;
            }
        } else if (!rightAfterBrackets && !inBrackets) {
            if (_str[i] === " ") {
                params.push(currentParam);
                currentParam = "";
                continue;
            }
        }

        currentParam += _str[i];
    }

    params.push(currentParam);

    return params;
}

client.on('message', async (message) => {
    if (message.toString().toLowerCase().substring(0, 1) === prefix) {
        var command = message.toString().substr(prefix.length, message.toString().indexOf(' ') - 1);
        if (command === "") command = message.toString().substr(prefix.length);

        var params = getParams(message.toString().substr(command.length + 2, message.toString().length));

        if (command === "setprefix") {
            if (message.member.hasPermission("ADMINISTRATOR")) {
                if (params.length > 0) {
                    prefix = params[0];

                    fs.writeFile(appRoot + '/prefix.txt', params[0], function (err) {

                    });

                    var everyoneRole = message.guild.roles.find('name', '@everyone')

                    message.channel.send(everyoneRole.toString() + ", This server now uses the prefix \"***" + params[0] + "***\" for commands!");
                    client.user.setGame(prefix + "help");
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

                for (var key in topicAliases) {
                    if (!topicAliases.hasOwnProperty(key)) continue;
                    if (key === params[0]) {
                        requestType = topicAliases[key];
                    }
                }

                message.guild.roles.forEach(function (rol) {
                    if (rol.name.length > 6) {
                        if (rol.name.substring(0, rol.name.length - 7).toLowerCase() === requestType.toLowerCase()) {
                            message.guild.channels.forEach(function (channel) {
                                if (channel.name === "mentors") {
                                    channel.send("<@&" + rol.id + ">" + ", The user <@" + message.author.id + "> requested a **" + requestType + "** mentor! Click the ***white check mark*** to accept the request.").then(function (sm) { sm.react("✅"); openRequests[sm.id] = message; });
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
        } else if (command === "topicalias") {
            if (params.length > 1) {
                topicAliases[params[1]] = params[0];

                var str = "";

                for (var key in topicAliases) {
                    if (!topicAliases.hasOwnProperty(key)) continue;
                    str += "[" + key + "] [" + topicAliases[key] + "]\n";
                }

                fs.writeFile(appRoot + '/topic_aliases.txt', str, function (err) {

                })
            }
        } else if (command === "help") {
            var msg = "KDT-Bot is a Discord bot developed by <@138988491240505345> for the Krypton Development Team.\n\n";
            msg += "**help**: Sends you this message.\n\n";
            msg += "**requestmentor**: Must be called with a parameter. Request help for the specified topic.\n\n";
            msg += "**setprefix**: Administrators only and needs a parameter. Sets the global prefix of the bot."
            //msg += "**";
            message.member.send(msg);
        }
    }
});

client.on("messageReactionAdd", async (msg) => {
    if (openRequests[msg.message.id] !== undefined) {
        if (msg.users.size > 1) {
            var men = msg.users.last();

            this.currentID = men.id;

            msg.message.guild.members.forEach(function (m) {
                if (m.id === this.currentID) {
                    this.member = m;
                }
            }.bind(this));

            this.allowed = false;

            this.member.roles.forEach(function (rol) {
                if (rol.id === msg.message.toString().substr(3, msg.message.toString().indexOf(">") - 3) && this.currentID !== openRequests[msg.message.id].member.id) {
                    console.log(msg.message.member.id + " " + openRequests[msg.message.id].member.id);

                    this.allowed = true;
                }
            }.bind(this));

            if (!this.allowed)
                return;

            this.allowed = false;

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

client.on("guildMemberAdd", async (user) => {
    user.guild.defaultChannel.send("Welcome, <@" + user.id + ">!\n\n" + `Use ***${prefix}help*** to get a list of commands\nor ***${prefix}requestmentor*** to *request help for a topic.*`);
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
    client.user.setGame(prefix + "help");

    filec = fs.readFileSync(appRoot + '/topic_aliases.txt', 'utf8');
    lines = filec.split("\r\n");

    lines.forEach((l) => {
        var parts = getParams(l);
        var alias = parts[0];
        var lang = parts[1];
        alias = alias.split('[').join('');
        alias = alias.split(']').join('');
        lang = lang.split('[').join('');
        lang = lang.split(']').join('');

        topicAliases[alias] = lang;
    });
});

client.login(process.argv[2]);