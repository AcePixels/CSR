const Discord = require('discord.js');
const helper = require('./helper');
const Bot=require('./bot')
const client = new Bot();
const commandHandler = require('easy-djs-commandhandler');
require('./env').load('.env');
const prefix = process.env.prefix || 'c-';
const cmdHandler = new commandHandler.Handler(client,
	{
		prefix: prefix,
		owners: ['298258003470319616', '193406800614129664'],
		defaultcmds:true,
	});
client.filter=[];
const noInvites = /(discord\.gg\/|invite\.gg\/|discord\.io\/|discordapp\.com\/invite\/)/;
// ////////////////////////////////////////////////////////////////////////////
client.on('ready', ()=>{
	console.log('irc connected');
	client.user.setActivity(`${prefix}help`);
	client.db.use('data');
	const rows = client.db.fetch('bans');
	if(rows) {
		for(const i in rows) {
			client.banlist.set(i, rows[i]);
		}
	}
	/**
	 * @type {string[]}
	 */
	let words=client.db.secure('filter',[])
	if(words.length){
		for(let word of words){
			client.filter.push(word)
		}
	}

});

// //////////////////////////////////////////////////////////////////////////////////

function findemoji(name) {
	const em = client.guilds.get('497475921855381525').emojis.find(x=>x.name === name);
	if(em) {
		return em;
	}
	else{
		new Error('no emoji found');
	}
}

// ////////////////////////////////////////////////////////
client.on('guildCreate', async (guild)=>{
	if(!guild.available) {return;}
	console.log('joined server ' + guild.name);
	let irc=await guild.createChannel('irc',{type:'text'}).catch(()=>{});
	await irc.send(helper.insertRules(client)).catch(()=>{});
	if(irc){
		client.db.use('channels')
		let data=client.db.secure(guild.id,{
			name: null,
			public: { id: null, name: null },
			private: { id: null, name: null, passcode: null },
		})
		data.name=guild.name
		data.public={id:irc.id,name:irc.name}
		client.db.insert(guild.id,data)
	}
	const ed = new Discord.RichEmbed()
		.setColor([0, 255, 0])
		.setAuthor(`${guild.name}`, (guild.iconURL || client.user.defaultAvatarURL))
		.setDescription(`has joined the chat ${System.findEmoji('join')}`);
	client.system.sendAll(ed);
});
// ////////////////////////////////////////////////////////////////////////////
client.on('guildDelete', (guild)=>{
	if(!guild.available) {return;}
	client.db.use('channels')
	client.db.delete(guild.id)
	console.log('bot removed from server ' + guild.name);
	const ed = new Discord.RichEmbed()
		.setColor([255, 0, 0])
		.setAuthor(`${guild.name}`, (guild.iconURL || client.user.defaultAvatarURL))
		.setDescription(`has left the chat ${client.system.findEmoji('leave')}`);
	client.system.sendAll(ed);

});
// ///////////MAIN MESSAGE EVENT/////////////////////////////////////////////
client.on('message', (message)=>{
	if(message.content.startsWith(prefix)) return;
	if (message.author == client.user || message.author.bot || !message.guild || message.system) return;
	if(noInvites.test(message.content)) return;
	if(message.content.includes('﷽') || message.guild.name.includes('﷽') || message.cleanContent.includes('naked photo'))  return;
	if(lockdownExpired(limitTime)) {
		endLockdown();
	}
	if(client.lockdown.enabled && !client.staff.has(message.author.id)) return;
	const channel = client.system.getChannel(message.guild);
	const privchannel = client.system.getPrivateChannel(message.guild);
	if(channel && message.channel.id === channel.id) {
		if(client.csrCooldowns.has(message.author.id)) {return;}
		broadcastToAllCSRChannels(message);
		client.csrCooldowns.set(message.author.id);
		setTimeout(() => {
			client.csrCooldowns.delete(message.author.id);
		}, 2000);
	}
	else if(privchannel && message.channel.id === privchannel.id) {
		sendPrivate(message,message.guild);
	}
});
/////////////////////////
client.on('messageReactionAdd',(reaction,user)=>{
	let message=reaction.message
	let guild=message.guild
	let channel=message.channel
	let ircChannel=client.getPublicChannel(guild)
	if(!message.embeds[0] || message.author.id!=client.user.id||!(ircChannel&&ircChannel.id===channel.id)){
		return
	}
	let CSRMessageAuthor=client.users.find(x=>x.tag==message.embeds[0].author.name)
	if(!CSRMessageAuthor||(CSRMessageAuthor.id!=user.id && !client.staff.has(user.id))){
		return 
	}
	let messages=System.findMatchingMessages(CSRMessageAuthor.tag,message.embeds[0].description)
	
	messages.forEach(msg=>msg.delete().catch(e=>{}))
})
// ///////////////////////////////////////////
client.on('message', (message)=>{
	cmdHandler.handle(client, message);
});
// /RATE LIMIT EVENT/////////////////////////////////////////////////////////////
let limitcount = 0;
const limitTime = 0;
client.on('rateLimit', (ratelimit)=>{
	console.log(ratelimit);
	if(ratelimit) {
		limitcount += 1;
		if(limitcount >= 3) {
			initLockdown();
			client.lockdown.time += 7000;
			limitcount = 0;
		}
	}
});

/**
 *
 * @param {Discord.Message} message
 */
async function broadcastToAllCSRChannels(message) {
	if(message.author.createdAt>(new Date().getTime()-604800000)) {
		return;
	}
	if(client.filter.some(word=>message.cleanContent.includes(word))){
		return
	}
	if(client.banlist.has(message.author.id)) {
		return;

	}
	// if(!message.attachments.size && !message.deleted) {
	//	message.delete(500);
	// }
	const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
	await wait(1000);
	const embed = generateEmbed(message);
	message.channel.send(embed);
	client.system.sendAll(embed, { ignoreGuilds:[message.guild.id] });
}


/**
 *
 * @param {Discord.Message} message
 */
async function sendPrivate(message) {
	const channel = client.system.getPrivateChannel(message.guild);
	if(!channel) {return;}

	if(!message.attachments.size && !message.deleted) {
		message.delete(500);
	}

	const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
	await wait(1000);

	const ed = generateEmbed(message);
	const channels = client.system.getMatchingPrivate(message.guild);
	channels.forEach(ch=>{
		/*if(!ch.nsfw && ch.topic.includes('nsfw')) {
			return ch.send('Received new Message\nBut this Channel is not NSFW').catch(e=>{
				console.log(e);
				if(e.message == 'Unknown Channel') {
					// cachePrivateChannels();
				}
			});
		}*/

		ch.send(ed)
			.catch(e=>{
				console.log(e);
				if(e.message == 'Unknown Channel') {
					// cachePrivateChannels();
				}
			});
	});
}
// ///error event./////////////////

client.on('error', (err)=>{
	console.log(err);
});

// unhandled rej ///////////////////////////////////////////////////////////////////////
process.on('unhandledRejection', (err) => {
	console.error(err);
	if (err.name == 'DiscordAPIError' && err.message == '401: Unauthorized') return process.exit();

	if(err.name == 'DiscordAPIError') {
		let addInfo = 'None Found!';
		if(err.path !== undefined) {
			const split = err.path.split('/');
			const info = getDebugInfo(split);
			addInfo = `Additional Debug Info:\n\tChannel: ${info.channel ? info.channel.name : 'Unknown'}\n\tGuild: ${info.channel ? info.channel.guild ? info.channel.guild.name : 'Unknown' : 'Unknown'}\n\tmessage content:${info.message ? info.message.cleanContent : 'None Found!'}}`;
		}

		return (client.channels.get('543167247330312232')).send(`
	\`\`\`js
	Error: ${require('util').inspect(err).slice(0, 1800)}

	${addInfo}
		\`\`\`
		`);
	}


	return (client.channels.get('543167247330312232')).send(`
\`\`\`xs
Error: ${err.name}
    ${err.message}
    ${err.stack}
    \`\`\`
    `);
});

function getDebugInfo(arr) {
	const data = {};
	if(arr[3] == 'channels') {
		const channel = client.channels.get(arr[4]);
		if(channel) {
			data.channel = channel;
			data.guild = channel.guild;
		}
	}
	if(arr[3] == 'guilds') {
		const guild = client.guilds.get(arr[4]);
		if(guild) {
			data.guild = guild;
		}
	}
	if(!arr[5])return data;

	if(arr[5] == 'permissions') {
		const role = data.channel.guild.roles.get(arr[6]);
		if(role) {
			data.role = role;
		}

	}
	if(arr[5] == 'messages') {
		const channel = client.channels.get(arr[4]);
		if(channel) {
			const msg = channel.messages.get(arr[6]);
			if(msg) {
				data.message = msg;
			}
		}
	}
	return data;
}

/**
 *
 *
 * @param {Discord.Message} message
 * @returns {Discord.RichEmbed}
 */
function generateEmbed(message) {
	const relayEmbed = new Discord.RichEmbed()
		.setAuthor(`${message.author.tag}`, message.author.displayAvatarURL, `https://discordapp.com/users/${message.author.id}`)
		.setDescription(message.cleanContent)
		.setTimestamp(new Date())
		.setFooter(message.guild.name, (message.guild.iconURL || client.user.defaultAvatarURL));
	let customColors=client.customColors
	if(customColors.has(message.author.id)){
		relayEmbed.setColor(customColors.get(message.author.id).color);
		relayembed.setAuthor(`${message.author.tag}`, message.author.displayAvatarURL, `https://discordapp.com/users/${message.author.id}`);
	}
	else if(client.staff.has(message.author.id)) {
		relayEmbed.setColor([0, 0, 128]);
	}
	else if(message.author.id === message.guild.owner.id) {
		relayEmbed.setColor([205, 205, 0]);
	}
	else{
		relayEmbed.setColor([133, 133, 133]);
	}

	// find and add image
	if(message.attachments.array()[0]) {
		const img = message.attachments.array()[0];
		if(img.filename.endsWith('.jpg') || img.filename.endsWith('.png') || img.filename.endsWith('.gif') || img.filename.endsWith('.jpeg') || img.filename.endsWith('.PNG')) {
			relayEmbed.setImage(img.url);
		}
		else{
			relayEmbed.addField('Attachment', img.url, false);
		}

	}
	// fetch external embeds and place them there
	const externalembed = new Discord.RichEmbed(message.embeds[0]);
	// if(externalembed) {
	externalembed.title && externalembed.description ? relayEmbed.addField(`${externalembed.title}`, externalembed.description) : '';
	externalembed.thumbnail ? relayEmbed.setThumbnail(externalembed.thumbnail.url) : '';
	// }
	return relayEmbed;
}

function lockdownExpired(time) {
	// console.log(client.lockdown.time);
	const x = new Date().getTime;
	const timeleft = x - time;
	if (timeleft > time || !time) {
		return true;
	}
	else {
		return false;
	}
}
function initLockdown() {
	client.lockdown.enabled = true;
	client.user.setActivity(`${prefix}help | locking down due to ratelimits`);
}

function endLockdown() {
	client.lockdown.enabled = false;
	client.lockdown.time = 0;
	client.user.setActivity(`${prefix}help`);
}
// /////////////////////////////////////////////////////////////////////////////////
client.login(process.env.token);
