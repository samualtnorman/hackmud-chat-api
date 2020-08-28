import { request } from "https"

interface LooseObject<T = any> {
	[key: string]: T | undefined
}

type JSONValue = string | number | boolean | JSONValue[] | LooseObject<JSONValue> | null

type APIResponse = LooseObject<JSONValue> & { ok: true }

export async function tellMessage(chatToken: string, from: string, to: string, message: string) {
	await api("create_chat", { chat_token: chatToken, username: from, tell: to, msg: message })
}

export async function sendMessage(chatToken: string, from: string, channel: string, message: string) {
	await api("create_chat", { chat_token: chatToken, username: from, channel, msg: message })
}

export async function getMessages(chatToken: string, usernames: string[], before: number, after: number) {
	return (await api("chats", { chat_token: chatToken, usernames, before, after })).chats
}

export async function getChannels(chatToken: string, mapChannels?: false): Promise<Map<string, string[]>>
export async function getChannels(chatToken: string, mapChannels: true): Promise<{ users: Map<string, string[]>, channels: Map<string, string[]> }>
export async function getChannels(chatToken: string, mapChannels = false) {
	const usersData = (await api("account_data", { chat_token: chatToken })).users

	const users = new Map<string, string[]>()
	const channels = new Map<string, string[]>()

	for (let user in usersData) {
		const channelsData = usersData[user] as NonNullable<typeof usersData[typeof user]>

		users.set(user, Object.keys(channelsData))

		if (mapChannels)
			for (const channel in channelsData) {
				const usersInChannel = channelsData[channel] as NonNullable<typeof channelsData[typeof channel]>

				if (!channels.get(channel))
					channels.set(channel, usersInChannel)
			}
	}

	if (mapChannels)
		return { users, channels }

	return users
}

export async function getToken(pass: string) {
	return (await api("get_token", { pass })).chat_token
}

function api(method: "create_chat", args: {
	chat_token: string
	username: string
	tell: string
	msg: string
}): Promise<{
	ok: true
}>

function api(method: "create_chat", args: {
	chat_token: string
	username: string
	channel: string
	msg: string
}): Promise<{
	ok: true
}>

function api(method: "chats", args: {
	chat_token: string
	usernames: string[]
	before: number
	after: number
}): Promise<{
	ok: true
	chats: LooseObject<{
		id: string
		t: number
		from_user: string
		msg: string
		is_join: boolean
		channel: string
	}[]>
}>

function api(method: "account_data", args: {
	chat_token: string
}): Promise<{
	ok: true
	users: LooseObject<LooseObject<string[]>>
}>

function api(method: "get_token", args: {
	pass: string
}): Promise<{
	ok: true
	chat_token: string
}>

function api(method: string, args: object) {
	let data = ""

	return new Promise<APIResponse>((resolve, reject) => {
		request({
			method: "POST",
			hostname: "www.hackmud.com",
			path: `/mobile/${method}.json`,
			headers: {
				"Content-Type": "application/json"
			}
		}, res => res.on("data", (chunk: Buffer) => data += chunk.toString()).on("end", () => {
			const response = JSON.parse(data.toString()) as APIResponse | { ok: false, msg: string }

			if (response.ok)
				resolve(response)
			else
				reject(response.msg)
		})).end(JSON.stringify(args))
	})
}
