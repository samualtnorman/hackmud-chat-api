# hackmud-chat-api
![Build Test](https://github.com/samualtnorman/hackmud-chat-api/workflows/Build%20Test/badge.svg)

alternative hackmud chat api wrapper for node

example:
```javascript
const { Client, MessageType } = require("@samual/hackmud-chat-api")

const MY_USER = "mr_bot" // this should be one of your users
const MY_TOKEN = "91w6zc1teswMyIG2QJag" // this can also be your chat pass

const client = new Client(MY_TOKEN)

client.onStart(token => {
	console.log("my token is", token)
})

client.onMessage(messages => {
	for (const message of messages) {
		if (message.type == MessageType.Tell && message.content == "ping")
			client.tellMessage(MY_USER, message.user, "pong!")
	}
})

client.sendMessage(MY_USER, "0000", "hello, I am a bot")
```
