export interface InstagramPost {
  caption: string;
  id: string;
  media_type: string;
  media_url: string;
  permalink: string;
}

interface InstagramProps {
  post: InstagramPost[] | null;
  postCount: number;
}

const Instagram = ({post, postCount}: InstagramProps) => {
  return (
    <div>
      <h2>Instagram</h2>
      {post?.slice(0, postCount).map((item) => (
        <p key={item.id} className="m-10">
          {item.caption}
        </p>
      ))}
    </div>
  );
};

export default Instagram;
