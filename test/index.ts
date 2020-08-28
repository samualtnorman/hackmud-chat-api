import { getChannels } from "..";

const chatToken = "";

(async () => {
	console.log(await getChannels(chatToken, true))
})()
