import fileType from 'file-type';
import { Service } from '../Context';
import { FetchImage, FetchOriginalImage } from './image';
import { GalleryItem, GalleryItemType } from './GalleryItem';

export type Gallery = {
  upload: ({ file, domainId, type }: { file: any; domainId: string; type: GalleryItemType }) => Promise<GalleryItem>;
  fetchOriginalImage: FetchOriginalImage;
  fetchImage: FetchImage;
};

const gallery: Service<Gallery> = context => {
  const {
    $id,
    $aws,
    $mongo: { $startTransaction, $save },
  } = context;

  const fetchOriginalImage = FetchOriginalImage(context);
  const fetchImage = FetchImage(context, fetchOriginalImage);

  return {
    upload: ({ file, domainId, type }) => {
      const { buffer, mimetype, originalname } = file;
      return fileType.fromBuffer(buffer).then(fileType => {
        const newGalleryItem: GalleryItem = {
          _id: $id(),
          domainId,
          type,
          fileInfo: {
            originalname,
            ext: fileType?.ext,
            mime: fileType?.mime,
            type: mimetype,
          },
          tags: [],
          suggestedTags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        return $startTransaction(session => {
<<<<<<< HEAD
          return $save('gallery', newGalleryItem, { session }).then(() => $aws.uploadDocToS3(buffer, newGalleryItem._id));
        }).then(() => newGalleryItem);
=======
          return $save('gallery', newGalleryItem, { session }).then(() => $aws.uploadToS3(buffer, newGalleryItem._id));
        });
>>>>>>> bbc23fc8e3805e7e70629435149d806c5c48f380
      });
    },
    fetchOriginalImage,
    fetchImage,
  };
};

export default gallery;