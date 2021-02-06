import { HackmudChatAPI } from "./"

const hackmudChatAPI = new HackmudChatAPI("19HRJXdR5rEn2NrrZnVo")

console.log(Date.now())

hackmudChatAPI.tellMessage("samual", "samual", Date.now().toString())

hackmudChatAPI.onStart(console.log)
