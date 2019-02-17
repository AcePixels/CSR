module.exports = {
    name: 'lockdown',
    staff: 'sends the rules to using the #irc channel',
    execute(message) {
        const {staff}=require(`./stafflist.json`)  
        if(!staff.includes(message.author.id)){ 
            return message.channel.send('you dont have access to that command')
        }
        if(message.client.lockdown){
            message.client.lockdown=false
            message.channel.send('lockdown ended')
        }
        else{
            message.client.lockdown=true
            message.channel.send('lockdown has begun')
        }
    },
};