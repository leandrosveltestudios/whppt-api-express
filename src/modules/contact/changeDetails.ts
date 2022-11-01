import assert from 'assert';
import { assign } from 'lodash';
import { HttpModule } from '../HttpModule';
import { Contact } from './Models/Contact';

const changeDetails: HttpModule<
  {
    firstName: string;
    lastName: string;
    phone: string;
    contactId: string;
    company: string;
    email: string;
  },
  void
> = {
  exec(
    { $database, createEvent },
    { firstName, lastName, phone, company, contactId, email }
  ) {
    assert(firstName, 'A First name is required');
    assert(lastName, 'A last name is required');

    return $database.then(database => {
      const { document, startTransaction } = database;

      return Promise.all([
        document.fetch<Contact>('contacts', contactId),
        document.query<Contact>('contacts', {
          filter: { email, _id: { $ne: contactId } },
        }),
      ]).then(([contact, emailInUse]) => {
        assert(contact, 'Unable to find Contact.');
        if (email) assert(!emailInUse, 'Email already in use.');

        if (noChanges(contact, { firstName, lastName, phone, company, email })) return;

        const contactEvents = [
          createEvent('ContactDetailsChanged', {
            contactId: contact._id,
            firstName,
            lastName,
            phone,
            company,
            email,
            from: {
              firstName: contact.firstName,
              lastName: contact.lastName,
              phone: contact.phone,
              company: contact.company,
              email: contact.email,
            },
          }),
        ];
        assign(contact, { firstName, lastName, phone, company });

        return startTransaction(session => {
          return document.saveWithEvents('contacts', contact, contactEvents, { session });
        });
      });
    });
  },
};

const noChanges = (
  contact: Contact,
  {
    firstName,
    lastName,
    phone,
    company,
    email,
  }: {
    firstName: string;
    lastName: string;
    phone: string;
    company: string;
    email: string;
  }
) => {
  return (
    contact.firstName === firstName &&
    contact.lastName === lastName &&
    contact.company === company &&
    contact.email === email &&
    contact.phone === phone
  );
};

export default changeDetails;
