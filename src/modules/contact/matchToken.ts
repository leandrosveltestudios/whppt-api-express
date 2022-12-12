import assert from 'assert';
import { HttpModule } from '../HttpModule';
import { Member } from '../member/Model';
import { Staff } from '../staff/Model';
import { Contact } from './Models/Contact';

const matchToken: HttpModule<{ email: string; token: string }, any> = {
  exec({ $database }, { email, token }) {
    assert(email, 'A email is required');
    assert(token, 'A token is required');

    return $database.then(database => {
      const { document } = database;

      const matchToken = (collection: string, contactId: string) => {
        return document
          .query<Staff | Member>(collection, {
            filter: {
              contactId,
              'token.token': token,
            },
          })
          .then(user => user);
      };

      const matchesStaff = (contactId: string) => matchToken('staff', contactId);
      const matchesMember = (contactId: string) => matchToken('member', contactId);

      return document.query<Contact>('contacts', { filter: { email } }).then(contact => {
        if (contact?._id) {
          return matchesStaff(contact._id).then(staff => {
            return staff?._id ? staff : matchesMember(contact._id).then(member => member);
          });
        }

        return undefined;
      });
    });
  },
};

export default matchToken;
