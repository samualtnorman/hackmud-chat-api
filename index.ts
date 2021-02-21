import { request } from "https"

type RawMessage = {
	id: string
	t: number
	from_user: string
	msg: string
}

/**
 * A message sent in a channel using "send"
 */
export type ChannelMessage = {
	id: string
	user: string
	type: MessageType.Join | MessageType.Leave | MessageType.Send
	content: string
	channel: string
	time: number
	toUsers: string[]
}

/**
 * A message sent in a tell using "tell"
 */
export type TellMessage = {
	id: string
	user: string
	type: MessageType.Tell
	content: string
	time: number
	toUser: string
}

/**
 * Used to differentiate between message types
 *
 * @example
 * if (message.type == MessageType.Tell) {
 * 	// ...
 * }
 */
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

/**
 * Stores state so you don't have to
 */
export class Client {
	private token: string | null = null
	private time = Date.now() / 1000
	private startHandlers: StartHandler[] | null = []
	private messageHandlers: MessageHandler[] = []
	private users: string[] | null = null
	private timeout: NodeJS.Timeout | null = null
	private lastMessageId = ""

	constructor(tokenOrPass: string) {
		if (tokenOrPass.length == 5)
			getToken(tokenOrPass).then(token => this.init(token))
		else
			this.init(tokenOrPass)
	}

	/**
	 * Runs given callback upon starting
	 *
	 * @param startHandler callback
	 */
	onStart(startHandler: StartHandler) {
		if (!this.startHandlers)
			throw new Error("already started")

		this.startHandlers.push(startHandler)

		return this
	}

	/**
	 * Runs given callback for all messages that are recieved
	 *
	 * @param messageHandler callback
	 */
	onMessage(messageHandler: MessageHandler) {
		this.messageHandlers.push(messageHandler)

		if (!this.timeout) {
			if (this.users)
				this.startGetMessagesLoop()
			else
				this.onStart(() => this.startGetMessagesLoop())
		}

		return this
	}

	/**
	 * Tells a message to a user
	 *
	 * @param from your user
	 * @param to target user
	 * @param message to send
	 *
	 * @returns a promise that resolves when request to server is complete
	 */
	tellMessage(from: string, to: string, message: string) {
		if (this.token)
			return tellMessage(this.token, from, to, message)

		return new Promise<{ ok: true }>(resolve =>
			this.onStart(token => resolve(tellMessage(token, from, to, message)))
		)
	}

	/**
	 * Sends a message to a channel
	 *
	 * @param from your user
	 * @param channel target channel
	 * @param message to send
	 *
	 * @returns a promise that resolves when request to server is complete
	 */
	sendMessage(from: string, channel: string, message: string) {
		if (this.token)
			return sendMessage(this.token, from, channel, message)

		return new Promise<{ ok: true }>(resolve =>
			this.onStart(token => resolve(sendMessage(token, from, channel, message)))
		)
	}

	/**
	 * Gets you messages recieved from the given date to 10 minutes after the given date
	 *
	 * @param usernames users you want to get messages for
	 * @param after ruby timestamp (seconds since 1970) of start date to get messages from
	 *
	 * @returns a promise that resolves to an array of channel and tell messages
	 *
	 * @example hackmudChatAPI.getMessages("mr_bot", (Date.now() / 1000) - 60)
	 */
	getMessages(usernames: string | string[], after: number) {
		if (this.token)
			return getMessages(this.token, usernames, after)

		return new Promise<(ChannelMessage | TellMessage)[]>(resolve =>
			this.onStart(token => resolve(getMessages(token, usernames, after)))
		)
	}

	/**
	 * Gets you channels users are in
	 *
	 * @param mapChannels whether to also map the channels that other users are in
	 *
	 * @returns a promise that resolves to either a map of your users to the channels they are in
	 * @returns an object containing the prior and a map of channels to the users that are in them
	 */
	getChannels(mapChannels?: false): Promise<Map<string, string[]>>
	getChannels(mapChannels: true): Promise<{ users: Map<string, string[]>, channels: Map<string, string[]> }>
	getChannels(mapChannels = false) {
		if (this.token)
			return getChannels(this.token, mapChannels as any)

		return new Promise(resolve =>
			this.onStart(token => resolve(getChannels(token, mapChannels as any)))
		)
	}

	private async init(token: string) {
		this.token = token
		this.users = [ ...(await getChannels(token)).keys() ]

		for (const startHandler of this.startHandlers!)
			startHandler(token)

		this.startHandlers = null
	}

	private async startGetMessagesLoop() {
		if (!this.startHandlers)
			this.time = Date.now() / 1000

		this.getMessagesLoop()
		this.timeout = setTimeout(() => this.getMessagesLoop(), 2000)
	}

	private async getMessagesLoop() {
		const messages = await getMessages(this.token!, this.users!, this.time)

		if (messages.length) {
			if (messages[0].id == this.lastMessageId)
				messages.shift()

			if (messages.length) {
				const lastMessage = messages[messages.length - 1]

				this.time = lastMessage.time
				this.lastMessageId = lastMessage.id

				for (const messageHandler of this.messageHandlers)
					messageHandler(messages)
			}
		} else
			this.time = Date.now() / 1000

		this.timeout?.refresh()
	}
}

/**
 *
 * @param pass your pass recieved using `chat_pass`
 *
 * @returns a promise that resolves to a chat token
 */
export async function getToken(pass: string) {
	return (await api("get_token", { pass })).chat_token
}

/**
 * Tells a message to a user
 *
 * @param chatToken your chat token
 * @param from your user
 * @param to target user
 * @param message to send
 *
 * @returns a promise that resolves when request to server is complete
 */
export function tellMessage(chatToken: string, from: string, to: string, message: string) {
	return api("create_chat", { chat_token: chatToken, username: from, tell: to, msg: message })
}

/**
 * Sends a message to a channel
 *
 * @param chatToken your chat token
 * @param from your user
 * @param channel target channel
 * @param message to send
 *
 * @returns a promise that resolves when request to server is complete
 */
export function sendMessage(chatToken: string, from: string, channel: string, message: string) {
	return api("create_chat", { chat_token: chatToken, username: from, channel, msg: message })
}

/**
 * Gets you messages recieved from the given date to 10 minutes after the given date
 *
 * @param chatToken your chat token
 * @param usernames users you want to get messages for
 * @param after ruby timestamp (seconds since 1970) of start date to get messages from
 *
 * @returns a promise that resolves to an array of channel and tell messages
 *
 * @example hackmudChatAPI.getMessages("mr_bot", (Date.now() / 1000) - 60)
 */
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
					let type: MessageType

					if ("is_join" in message)
						type = MessageType.Join
					else if ("is_leave" in message)
						type = MessageType.Leave
					else
						type = MessageType.Send

					idMessages.set(message.id, {
						id: message.id,
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
					id: message.id,
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
 * Gets you channels users are in
 *
 * @param chatToken your chat token
 * @param mapChannels whether to also map the channels that other users are in
 *
 * @returns a promise that resolves to either a map of your users to the channels they are in
 * @returns an object containing the prior and a map of channels to the users that are in them
 */
export async function getChannels(chatToken: string, mapChannels?: false): Promise<Map<string, string[]>>
export async function getChannels(chatToken: string, mapChannels: true): Promise<{ users: Map<string, string[]>, channels: Map<string, string[]> }>
export async function getChannels(chatToken: string, mapChannels = false) {
	const usersData = (await api("account_data", { chat_token: chatToken })).users
	const users = new Map<string, string[]>()
	const channels = new Map<string, string[]>()

	for (let user in usersData) {
		const channelsData = usersData[user]

		users.set(user, Object.keys(channelsData))

		if (mapChannels) {
			for (const channel in channelsData) {
				if (!channels.get(channel))
					channels.set(channel, channelsData[channel])
			}
		}
	}

	if (mapChannels)
		return { users, channels }

	return users
}

/**
 * Make a raw API call
 */
export function api(method: "create_chat", args: {
	chat_token: string
	username: string
	tell: string
	msg: string
}, retries?: number): Promise<{
	ok: true
}>
export function api(method: "create_chat", args: {
	chat_token: string
	username: string
	channel: string
	msg: string
}, retries?: number): Promise<{
	ok: true
}>
export function api(method: "chats", args: {
	chat_token: string
	usernames: string[]
	before: number
}, retries?: number): Promise<{
	ok: true
	chats: Record<string, (RawTellMessage | RawChannelMessage | RawJoinMessage | RawLeaveMessage)[]>
}>
export function api(method: "chats", args: {
	chat_token: string
	usernames: string[]
	after: number
}, retries?: number): Promise<{
	ok: true
	chats: Record<string, (RawTellMessage | RawChannelMessage | RawJoinMessage | RawLeaveMessage)[]>
}>
export function api(method: "account_data", args: {
	chat_token: string
}, retries?: number): Promise<{
	ok: true
	users: Record<string, Record<string, string[]>>
}>
export function api(method: "get_token", args: {
	pass: string
}, retries?: number): Promise<{
	ok: true
	chat_token: string
}>
export function api(method: string, args: object, retries = 4) {
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

				// if (res.statusCode != 200)
				// 	return reject(new Error(`got status code '${res.statusCode}'`))

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
	}).catch(reason => {
		if (!retries)
			throw reason

		console.error(reason)
		return api(method as any, args as any, retries - 1)
	})
}
