import assert from 'assert';
import { assign } from 'lodash';
import { HttpModule } from '../HttpModule';
import { Member } from '../member/Model';
import { Staff } from '../staff/Model';
import { Contact } from './Models/Contact';

const matchEmail: HttpModule<{ email: string }, any> = {
  exec({ $database, $security, createEvent, apiKey }, { email }) {
    assert(email, 'A email is required');

    return $database.then(database => {
      const { document, startTransaction } = database;

      const matchEmail = (collection: string) => {
        return document
          .query<Contact>('contacts', { filter: { email } })
          .then(usedEmail => {
            if (!usedEmail) return undefined;

            return document
              .query<Staff | Member>(collection, {
                filter: { contactId: usedEmail._id },
              })
              .then(usedEmail => usedEmail);
          });
      };

      const matchesStaff = matchEmail('staff');
      const matchesMember = matchEmail('member');
      const events: any[] = [];

      return matchesStaff.then(staff => {
        if (staff) {
          events.push(createEvent('MatchedStaffEmail', { email }));
          return $security.generateAccessToken(apiKey, staff._id, 60).then(token => {
            assign(staff, { token });

            return startTransaction(session => {
              return document.saveWithEvents('staff', staff, events, { session });
            }).then(() => staff);
          });
        }

        return matchesMember.then(member => {
          if (!member) return undefined;
          if (member) {
            events.push(createEvent('MatchedMemberEmail', { email }));
            return $security.generateAccessToken(apiKey, member._id, 60).then(token => {
              assign(member, { token });

              return startTransaction(session => {
                return document.saveWithEvents('member', member, events, { session });
              }).then(() => member);
            });
          }
        });
      });
    });
  },
};

export default matchEmail;
