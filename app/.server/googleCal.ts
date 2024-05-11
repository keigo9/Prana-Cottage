import {google} from 'googleapis';

import {
  private_key as GOOGLE_PRIVATE_KEY,
  client_email as GOOGLE_CLIENT_EMAIL,
} from 'service-account-key.json';

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

const jwtClient = new google.auth.JWT(
  GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  SCOPES,
);

export function getEvents(
  GOOGLE_PROJECT_NUMBER: string,
  GOOGLE_CALENDAR_ID: string,
) {
  console.log('hello');
  console.log(google);
  // console.log(google);
  //   const calendar = google.calendar({
  //     version: 'v3',
  //     // project: GOOGLE_PROJECT_NUMBER,
  //     auth: jwtClient,
  //   });
  //   console.log('hello');
  //   console.log(GOOGLE_PROJECT_NUMBER, GOOGLE_CALENDAR_ID);
  //   console.log(GOOGLE_PRIVATE_KEY);
  // 現在以降の最新10件のイベントを取得
  //   calendar.events.list(
  //     {
  //       calendarId: GOOGLE_CALENDAR_ID,
  //       //timeMin: new Date().toISOString(),
  //       //timeMax: new Date().toISOString(),
  //       maxResults: 10,
  //       singleEvents: true,
  //       orderBy: 'startTime',
  //     },
  //     (error, result) => {
  //       if (error) {
  //         console.log(error);
  //       } else {
  //         if (result?.data?.items?.length) {
  //           console.log(result.data.items);
  //           //console.log(result.data.items.map((item) => console.log(item)))
  //           //console.log(result.data.items.filter((item) => !item.description?.includes("Pay")))
  //         } else {
  //           console.log('No upcoming events found.');
  //         }
  //       }
  //     },
  //   );
}
