import { HttpModule } from '../HttpModule';

const update: HttpModule<{ status: number }> = {
  authorise({ $roles }, { user }) {
    return $roles.validate(user, []);
  },
  exec() {
    // return loaded order

    return Promise.resolve({ status: 200 });
  },
};

export default update;
