import { request } from "https"

type RawMessage = {
	id: string
	t: number
	from_user: string
	msg: string
}

export type ChannelMessage = {
	user: string
	type: MessageType.Join | MessageType.Leave | MessageType.Send
	content: string
	channel: string
	time: number
	toUsers: string[]
}

export type TellMessage = {
	user: string
	type: MessageType.Tell
	content: string
	time: number
	toUser: string
}

export enum MessageType {
	Join, Leave, Send, Tell
}

type RawChannelMessage = RawMessage & { channel: string }
type RawTellMessage = RawMessage & { to_user: string }
type RawJoinMessage = RawChannelMessage & { is_join: true }
type RawLeaveMessage = RawChannelMessage & { is_leave: true }
type JSONValue = string | number | boolean | JSONValue[] | { [key: string]: JSONValue } | null
type APIResponse = Record<string, JSONValue> & { ok: true }
type MessageHandler = (messages: (ChannelMessage | TellMessage)[]) => void
type StartHandler = (token: string) => void

export class HackmudChatAPI {
	private token: string | null = null
	private lastMessageT = Date.now() / 1000
	private startHandlers: StartHandler[] = []
	private messageHandlers: MessageHandler[] = []
	private users: string[] | null = null

	constructor(tokenOrPass: string) {
		if (tokenOrPass.length == 5) {
			getToken(tokenOrPass).then(token => {
				this.token = token
				this.init()
			})
		} else {
			this.token = tokenOrPass
			this.init()
		}
	}

	onStart(startHandler: StartHandler) {
		this.startHandlers.push(startHandler)

		return this
	}

	onMessage(messageHandler: MessageHandler) {
		this.messageHandlers.push(messageHandler)

		return this
	}

	tellMessage(from: string, to: string, message: string) {
		if (this.token)
			return tellMessage(this.token, from, to, message)
		else {
			return new Promise(resolve => {
				this.onStart(async token =>
					resolve(tellMessage(token, from, to, message))
				)
			})
		}
	}

	sendMessage(from: string, channel: string, message: string) {
		if (this.token)
			return sendMessage(this.token, from, channel, message)
		else {
			return new Promise(resolve => {
				this.onStart(async token =>
					resolve(sendMessage(token, from, channel, message))
				)
			})
		}
	}

	getMessages(usernames: string | string[], after: number) {
		if (this.token)
			return getMessages(this.token, usernames, after)
		else {
			return new Promise(resolve => {
				this.onStart(async token =>
					resolve(getMessages(token, usernames, after))
				)
			})
		}
	}

	getChannels(mapChannels?: false): Promise<Map<string, string[]>>
	getChannels(mapChannels: true): Promise<{ users: Map<string, string[]>, channels: Map<string, string[]> }>
	getChannels(mapChannels = false) {
		if (this.token)
			return getChannels(this.token, mapChannels as any)
		else {
			return new Promise(resolve => {
				this.onStart(async token =>
					resolve(getChannels(token, mapChannels as any))
				)
			})
		}
	}

	private async init() {
		this.users = [ ...(await getChannels(this.token!)).keys() ]

		for (const startHandler of this.startHandlers)
			startHandler(this.token!)

		this.getMessagesLoop()
	}

	private async getMessagesLoop() {
		const messages = await getMessages(this.token!, this.users!, this.lastMessageT)

		if (messages.length) {
			if (messages[0].time == this.lastMessageT)
				messages.shift()

			if (messages.length) {
				this.lastMessageT = messages[messages.length - 1].time

				for (const messageHandler of this.messageHandlers)
					messageHandler(messages)
			}
		}

		setTimeout(() => this.getMessagesLoop(), 2000)
	}
}

/**
 *
 * @param pass
 */
export async function getToken(pass: string) {
	return (await api("get_token", { pass })).chat_token
}

export function tellMessage(chatToken: string, from: string, to: string, message: string) {
	return api("create_chat", { chat_token: chatToken, username: from, tell: to, msg: message })
}

export function sendMessage(chatToken: string, from: string, channel: string, message: string) {
	return api("create_chat", { chat_token: chatToken, username: from, channel, msg: message })
}

export async function getMessages(chatToken: string, usernames: string | string[], after: number) {
	if (typeof usernames == "string")
		usernames = [ usernames ]

	const chats = (await api("chats", {
		chat_token: chatToken,
		usernames,
		after
	})).chats

	const idMessages = new Map<string, ChannelMessage | TellMessage>()

	for (const [ user, messages ] of Object.entries(chats)) {
		for (const message of messages) {
			const idMessage = idMessages.get(message.id)

			if ("channel" in message) {
				if (idMessage)
					(idMessage as ChannelMessage).toUsers.push(user)
				else {
					let type: ChannelMessage["type"]

					if ("is_join" in message)
						type = MessageType.Join
					else if ("is_leave" in message)
						type = MessageType.Leave
					else
						type = MessageType.Send

					idMessages.set(message.id, {
						user: message.from_user,
						type,
						channel: message.channel,
						content: message.msg,
						time: message.t,
						toUsers: [ user ]
					})
				}
			} else {
				idMessages.set(message.id, {
					user: message.from_user,
					type: MessageType.Tell,
					content: message.msg,
					time: message.t,
					toUser: message.to_user
				})
			}
		}
	}

	return [ ...idMessages.values() ].sort((a, b) => a.time - b.time)
}

// export async function getMessagesBefore(chatToken: string, username: string, before: number): Promise<(Message | MessageChannel | MessageJoin | MessageLeave)[]>
// export async function getMessagesBefore(chatToken: string, username: string[], before: number): Promise<Record<string, (Message | MessageChannel | MessageJoin | MessageLeave)[]>>
// export async function getMessagesBefore(chatToken: string, username: string | string[], before: number) {
// 	if (typeof username == "string")
// 		return (await api("chats", {
// 			chat_token: chatToken,
// 			usernames: [ username ],
// 			before
// 		})).chats[username].sort((a, b) => a.t - b.t)
// 	else {
// 		const chats = (await api("chats", {
// 			chat_token: chatToken,
// 			usernames: username,
// 			before
// 		})).chats

// 		for (const messages of Object.values(chats))
// 			messages.sort((a, b) => a.t - b.t)

// 		return chats
// 	}
// }

/**
 * Maps your users to the channels they are in.
 *
 * @param chatToken The token provided by getToken()
 * @param mapChannels Whether to also map all channels your users are in to users in those channels.
 */
export async function getChannels(chatToken: string, mapChannels?: false): Promise<Map<string, string[]>>
export async function getChannels(chatToken: string, mapChannels: true): Promise<{ users: Map<string, string[]>, channels: Map<string, string[]> }>
export async function getChannels(chatToken: string, mapChannels = false) {
	const usersData = (await api("account_data", { chat_token: chatToken })).users
	const users = new Map<string, string[]>()
	const channels = new Map<string, string[]>()

	for (let user in usersData) {
		const channelsData = usersData[user]// as NonNullable<typeof usersData[typeof user]>

		users.set(user, Object.keys(channelsData))

		if (mapChannels)
			for (const channel in channelsData) {
				const usersInChannel = channelsData[channel]// as NonNullable<typeof channelsData[typeof channel]>

				if (!channels.get(channel))
					channels.set(channel, usersInChannel)
			}
	}

	if (mapChannels)
		return { users, channels }

	return users
}

export function api(method: "create_chat", args: {
	chat_token: string
	username: string
	tell: string
	msg: string
}): Promise<{
	ok: true
}>

export function api(method: "create_chat", args: {
	chat_token: string
	username: string
	channel: string
	msg: string
}): Promise<{
	ok: true
}>

export function api(method: "chats", args: {
	chat_token: string
	usernames: string[]
	before: number
}): Promise<{
	ok: true
	chats: Record<string, (RawTellMessage | RawChannelMessage | RawJoinMessage | RawLeaveMessage)[]>
}>

export function api(method: "chats", args: {
	chat_token: string
	usernames: string[]
	after: number
}): Promise<{
	ok: true
	chats: Record<string, (RawTellMessage | RawChannelMessage | RawJoinMessage | RawLeaveMessage)[]>
}>

export function api(method: "account_data", args: {
	chat_token: string
}): Promise<{
	ok: true
	users: Record<string, Record<string, string[]>>
}>

export function api(method: "get_token", args: {
	pass: string
}): Promise<{
	ok: true
	chat_token: string
}>

export function api(method: string, args: object) {
	const buffers: Buffer[] = []

	return new Promise<APIResponse>((resolve, reject) => {
		request({
			method: "POST",
			hostname: "www.hackmud.com",
			path: `/mobile/${method}.json`,
			headers: { "Content-Type": "application/json" }
		}, res => res
			.on("data", (buffer: Buffer) => buffers.push(buffer))
			.on("end", () => {
				if (res.statusCode == 401)
					return reject(new Error("expired or invalid token"))

				if (res.statusCode != 200)
					return reject(new Error(`got status code '${res.statusCode}'`))

				if (!res.headers["content-type"])
					return reject(new Error("missing content-type in headers"))

				const [ mimeType, ...args ] = res.headers["content-type"].toLowerCase().split("; ")

				if (mimeType != "application/json")
					return reject(new Error(`server response mime type was '${mimeType}'`))

				let charset

				for (const arg of args) {
					const [ key, value ] = arg.split("=")

					if (key == "charset")
						charset = value
				}

				if (!charset)
					charset = "utf-8"

				const response = JSON.parse(Buffer.concat(buffers).toString(charset as any)) as APIResponse | { ok: false, msg: string }

				if (response.ok)
					resolve(response)
				else
					reject(new Error(response.msg))

			})
		).end(JSON.stringify(args))
	})
}
