import { DomainEvent } from '../Events/CreateEvent';
import { DatabaseHostingConfig, HostingService } from '../Hosting';
import { IdService } from '../Id';
import { LoggerService } from '../Logger';
import { DatabaseMiddleware } from './middleware';
import { MongoDatabaseConnection } from './Mongo/Connection';
import { ConfigService } from '../Config';

export type DatabaseConnection = {
  getDatabase(configPromise: Promise<DatabaseHostingConfig>): Promise<WhpptDatabase>;
};

export type StartTransaction = (callback: (session: any) => Promise<any>) => Promise<any>;

export type DatabaseDocument = {
  _id: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastPublished?: Date;
  published?: boolean;
  [field: string]: any;
};

export type FetchAllDocuments = <T extends DatabaseDocument>(
  collection: string,
  removed: boolean
) => Promise<T[]>;
export type QueryDocuments = <T extends DatabaseDocument>(
  collection: string,
  query: {
    filter: { [key: string]: any };
    projection?: { [key: string]: any };
    limit?: number;
    skip?: number;
    sort?: { [key: string]: any };
  },
  options?: { session?: any }
) => Promise<T[]>;

export type CountDocuments = (
  collection: string,
  query: {
    filter: { [key: string]: any };
  },
  options?: { session?: any }
) => Promise<number>;

export type FetchDocument = <T extends DatabaseDocument>(
  collection: string,
  id: string
) => Promise<T>;

export type QueryDocument = <T extends DatabaseDocument>(
  collection: string,
  query: {
    filter: { [key: string]: any };
  }
) => Promise<T | null>;

export type SaveDocument = <T extends DatabaseDocument>(
  collection: string,
  doc: T,
  options?: { session?: any }
) => Promise<T>;

export type QueryDistinct = (
  collection: string,
  query: {
    distinct: string;
  }
) => Promise<string[]>;

export type SaveDocumentWithEvents = <T extends DatabaseDocument>(
  collection: string,
  doc: T,
  events: DomainEvent[],
  options: { session: any }
) => Promise<T>;

export type SaveDocumentToPubWithEvents = <T extends DatabaseDocument>(
  collection: string,
  doc: T,
  events: DomainEvent[],
  options: { session: any }
) => Promise<T>;

export type RecordHistory = <T extends { data: DatabaseDocument; user: any }>(
  collection: string,
  action: string,
  value: T,
  options: { session?: any } // TODO: ensure a session is always given
) => Promise<void>;

export type RemoveDocument = (
  collection: string,
  id: string,
  options: { session?: any }
) => Promise<void>;

export type DeleteDocument = (
  collection: string,
  id: string,
  options?: { session?: any }
) => Promise<any>;

export type PublishDocument = (
  collection: string,
  doc: any,
  options: { session?: any }
) => Promise<void>;

export type UnpublishDocument = (
  collection: string,
  _id: string,
  options?: { session?: any }
) => Promise<void>;

export type EnsureCollections = (collections: string[]) => Promise<void>;

export type WhpptDatabase = {
  startTransaction: StartTransaction;
  fetchAllDocuments: FetchAllDocuments;
  queryDocuments: QueryDocuments;
  countDocuments: CountDocuments;
  queryDistinct: QueryDistinct;
  document: {
    fetch: FetchDocument;
    query: QueryDocument;
    save: SaveDocument;
    saveWithEvents: SaveDocumentWithEvents;
    recordHistory: RecordHistory;
    delete: DeleteDocument;
    remove: RemoveDocument;
    publish: PublishDocument;
    unpublish: UnpublishDocument;
  };
  /**
   * @deprecated use startTransaction
   */
  $startTransaction: StartTransaction;
  /**
   * @deprecated use fetchAllDocuments
   */
  $list: FetchAllDocuments;
  /**
   * @deprecated use document.fetch
   */
  $fetch: FetchDocument;
  /**
   * @deprecated use document.save
   */
  $save: SaveDocument;
  /**
   * @deprecated use document.recordHistory
   */
  $record: RecordHistory;
  /**
   * @deprecated use document.delete
   */
  $delete: DeleteDocument;
  /**
   * @deprecated use document.remove
   */
  $remove: RemoveDocument;
  /**
   * @deprecated use document.publish
   */
  $publish: PublishDocument;
  /**
   * @deprecated use document.unpublish
   */
  $unpublish: UnpublishDocument;
  ensureCollections: (collections: string[]) => Promise<void>;
};

export type DatabaseServiceFactory = (
  logger: LoggerService,
  id: IdService,
  hosting: HostingService,
  config: ConfigService,
  adminDb: Promise<MongoDatabaseConnection>
) => DatabaseService;

export type DatabaseService = {
  adminDb: Promise<MongoDatabaseConnection>;
  getConnection(apiKey: string): Promise<DatabaseConnection>;
  middleware: DatabaseMiddleware;
};

export const DatabaseService: DatabaseServiceFactory = (
  logger,
  id,
  hosting,
  config,
  adminDb
) => {
  const connections: Record<string, DatabaseConnection> = {};

  const getConnection = (apiKey: string) => {
    const configPromise = hosting.getConfiguredDatabase(apiKey);
    return configPromise.then(dbConfig => {
      const connectionKey = `${dbConfig.type}_${dbConfig.instance._id}`;
      if (connections[connectionKey]) return Promise.resolve(connections[connectionKey]);

      switch (dbConfig.type) {
        case 'mongo':
          return MongoDatabaseConnection(
            logger,
            id,
            dbConfig,
            config.runtime.collections
          ).then(connection => {
            return connection.getDatabase(configPromise).then(() => {
              // TODO: hook up disconnection events so that we can remove the connection
              connections[connectionKey] = connection;
              return connection;
            });
          });
        default:
          throw new Error('Database connection could not be created');
      }
    });
  };
  const middleware = DatabaseMiddleware(logger, getConnection, adminDb);
  return {
    adminDb,
    getConnection,
    middleware,
  };
};
