import type { SapphireClientOptions } from '@sapphire/framework';
import type { ClientOptions } from 'discord.js';

export class ClientOptionsBuilder implements ClientOptions, SapphireClientOptions {
	public shards?: ClientOptions['shards'];
	public shardCount?: ClientOptions['shardCount'];
	public closeTimeout?: ClientOptions['closeTimeout'];
	public makeCache?: ClientOptions['makeCache'];
	public allowedMentions?: ClientOptions['allowedMentions'];
	public partials?: ClientOptions['partials'];
	public failIfNotExists?: ClientOptions['failIfNotExists'];
	public presence?: ClientOptions['presence'];
	public intents!: ClientOptions['intents'];
	public sweepers?: ClientOptions['sweepers'];
	public ws?: ClientOptions['ws'];

	public baseUserDirectory?: SapphireClientOptions['baseUserDirectory'];
	public caseInsensitiveCommands?: SapphireClientOptions['caseInsensitiveCommands'];
	public caseInsensitivePrefixes?: SapphireClientOptions['caseInsensitivePrefixes'];
	public defaultPrefix?: SapphireClientOptions['defaultPrefix'];
	public regexPrefix?: SapphireClientOptions['regexPrefix'];
	public fetchPrefix?: SapphireClientOptions['fetchPrefix'];
	public id?: SapphireClientOptions['id'];
	public logger?: SapphireClientOptions['logger'];
	public enableLoaderTraceLoggings?: SapphireClientOptions['enableLoaderTraceLoggings'];
	public loadDefaultErrorListeners?: SapphireClientOptions['loadDefaultErrorListeners'];
	public loadMessageCommandListeners?: SapphireClientOptions['loadMessageCommandListeners'];
	public typing?: SapphireClientOptions['typing'];
	public defaultCooldown?: SapphireClientOptions['defaultCooldown'];
	public disableMentionPrefix?: SapphireClientOptions['disableMentionPrefix'];

	public supportGuild!: ClientOptions['supportGuild'];

	public constructor(options?: ClientOptions & SapphireClientOptions) {
		if (options) Object.assign(this, options);
	}

	public setShardOptions(options: Pick<this, 'shards' | 'shardCount'>): this {
		if (options.shards) this.shards = options.shards;
		if (options.shardCount) this.shardCount = options.shardCount;
		return this;
	}

	public setCloseTimeout(options: Pick<this, 'closeTimeout'>): this {
		if (options.closeTimeout) this.closeTimeout = options.closeTimeout;
		return this;
	}

	public setMakeCache(options: Pick<this, 'makeCache'>): this {
		if (options.makeCache) this.makeCache = options.makeCache;
		return this;
	}

	public setMessageOptions(options: Pick<this, 'allowedMentions'>): this {
		if (options.allowedMentions) this.allowedMentions = options.allowedMentions;
		return this;
	}

	public setPartials(options: Pick<this, 'partials'>): this {
		if (options.partials) this.partials = options.partials;
		return this;
	}

	public setFailIfNotExists(options: Pick<this, 'failIfNotExists'>): this {
		if (options.failIfNotExists) this.failIfNotExists = options.failIfNotExists;
		return this;
	}

	public setPresence(options: Pick<this, 'presence'>): this {
		if (options.presence) this.presence = options.presence;
		return this;
	}

	public setIntents(options: Pick<this, 'intents'>): this {
		this.intents = options.intents;
		return this;
	}

	public setSweepers(options: Pick<this, 'sweepers'>): this {
		if (options.sweepers) this.sweepers = options.sweepers;
		return this;
	}

	public setWs(options: Pick<this, 'ws'>): this {
		if (options.ws) this.ws = options.ws;
		return this;
	}

	public setBaseUserDirectory(options: Pick<this, 'baseUserDirectory'>): this {
		if (options.baseUserDirectory) this.baseUserDirectory = options.baseUserDirectory;
		return this;
	}

	public setCommandOptions(
		options: Pick<
			this,
			| 'caseInsensitiveCommands'
			| 'caseInsensitivePrefixes'
			| 'defaultPrefix'
			| 'regexPrefix'
			| 'fetchPrefix'
			| 'typing'
			| 'defaultCooldown'
			| 'disableMentionPrefix'
		>
	): this {
		if (options.caseInsensitiveCommands) this.caseInsensitiveCommands = options.caseInsensitiveCommands;
		if (options.caseInsensitivePrefixes) this.caseInsensitivePrefixes = options.caseInsensitivePrefixes;
		if (options.defaultPrefix) this.defaultPrefix = options.defaultPrefix;
		if (options.regexPrefix) this.regexPrefix = options.regexPrefix;
		if (options.fetchPrefix) this.fetchPrefix = options.fetchPrefix;
		if (options.typing) this.typing = options.typing;
		if (options.defaultCooldown) this.defaultCooldown = options.defaultCooldown;
		if (options.disableMentionPrefix) this.disableMentionPrefix = options.disableMentionPrefix;
		return this;
	}

	public setId(options: Pick<this, 'id'>): this {
		if (options.id) this.id = options.id;
		return this;
	}

	public setLogOptions(options: Pick<this, 'logger' | 'enableLoaderTraceLoggings'>): this {
		if (options.logger) this.logger = options.logger;
		if (options.enableLoaderTraceLoggings) this.enableLoaderTraceLoggings = options.enableLoaderTraceLoggings;
		return this;
	}

	public setListenerOptions(options: Pick<this, 'loadDefaultErrorListeners' | 'loadMessageCommandListeners'>): this {
		if (options.loadDefaultErrorListeners) this.loadDefaultErrorListeners = options.loadDefaultErrorListeners;
		if (options.loadMessageCommandListeners) this.loadMessageCommandListeners = options.loadMessageCommandListeners;
		return this;
	}

	public setSupportGuild(options: Pick<this, 'supportGuild'>): this {
		if (options.supportGuild) this.supportGuild = options.supportGuild;
		return this;
	}
}
