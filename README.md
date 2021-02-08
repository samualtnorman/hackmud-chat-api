# hackmud-chat-api
![Build Test](https://github.com/samualtnorman/hackmud-chat-api/workflows/Build%20Test/badge.svg)

this is just another hackmud chat api for node, this time written in typescript

example:
```javascript
const { HackmudChatAPI, MessageType } = require("@samual/hackmud-chat-api")

const MY_USER = "mr_bot"
const MY_TOKEN = "91w6zc1teswMyIG2QJag" // this can also be your chat pass

const hackmudChatAPI = new HackmudChatAPI(MY_TOKEN)

hackmudChatAPI.onStart(token => {
	console.log("my token is", token)
})

hackmudChatAPI.onMessage(messages => {
	for (const message of messages) {
		if (message.type == MessageType.Tell && message.content == "ping")
			hackmudChatAPI.tellMessage(MY_USER, message.user, "pong!")
	}
})

hackmudChatAPI.sendMessage(MY_USER, "0000", "hello, I am a bot")
```
