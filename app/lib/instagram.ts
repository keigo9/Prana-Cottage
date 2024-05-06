import {InstagramPost} from '~/components/Instagram';

// InstagramAPIでユーザー基本情報を取得する
export async function instagramBasicDisplayApiProfile(
  USER_ID: string,
  ACCESS_TOKEN: string,
) {
  const url = `https://graph.instagram.com/${USER_ID}/?fields=username,id&access_token=${ACCESS_TOKEN}`;
  const response = await instagramApi(url, 'GET', '', ACCESS_TOKEN);

  try {
    if (response) {
      const data = await response.json();
      console.log(data);
      return data;
    } else {
      console.log('Instagram APIのリクエストでエラーが発生しました。');
      return null;
    }
  } catch (error) {
    console.log(
      'Instagram APIのレスポンスの解析中にエラーが発生しました:',
      error,
    );
    return null;
  }
}
interface InstagramPaging {
  cursors: {
    before: string;
    after: string;
  };
  next: string;
}

interface InstagramPostResponse {
  data: InstagramPost[];
  paging: InstagramPaging;
}

// 投稿IDを取得する
export async function instagramBasicDisplayApiPosts(
  USER_ID: string,
  ACCESS_TOKEN: string,
): Promise<InstagramPostResponse | null> {
  const url = `https://graph.instagram.com/${USER_ID}/media?fields=id,caption,media_type,media_url,permalink&access_token=${ACCESS_TOKEN}`;
  const response = await instagramApi(url, 'GET', '', ACCESS_TOKEN);

  try {
    if (response) {
      const data = await response.json();
      console.log(data);
      return data as InstagramPostResponse;
    } else {
      console.error('Instagram APIのリクエストでエラーが発生しました。');
      return null;
    }
  } catch (error) {
    console.error(
      'Instagram APIのレスポンスの解析中にエラーが発生しました:',
      error,
    );
    return null;
  }
}

// APIを叩く関数
async function instagramApi(
  url: string,
  method: string,
  payload: string,
  ACCESS_TOKEN: string,
) {
  try {
    const headers = {
      Authorization: 'Bearer ' + ACCESS_TOKEN,
    };
    const options = {
      method,
      headers,
      payload,
    };

    const response = await fetch(url, options);
    return response;
  } catch (error) {
    console.log('Instagram APIのリクエスト中にエラーが発生しました:', error);
    return null;
  }
}
