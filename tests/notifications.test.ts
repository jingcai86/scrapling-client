import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createPgPool,
  getDbUsers,
  upsertDbUser,
  createDbNotification,
  getDbNotifications,
  scraplingUser,
  scraplingUsers,
  scraplingNotifications,
  scraplingNotificationUsers,
  scraplingNotificationRecords,
  schema,
} from "../core/index.js";

describe("Notifications & Users Many-to-Many Architecture", () => {
  it("exports notification and user schema tables and relations in Drizzle schema", () => {
    assert.ok(scraplingUsers, "scraplingUsers should be defined");
    assert.ok(scraplingUser, "scraplingUser alias should be defined");
    assert.ok(scraplingNotifications, "scraplingNotifications should be defined");
    assert.ok(
      scraplingNotificationUsers,
      "scraplingNotificationUsers should be defined",
    );
    assert.ok(
      scraplingNotificationRecords,
      "scraplingNotificationRecords should be defined",
    );
    assert.ok(schema.scraplingUsers, "schema should export scraplingUsers");
    assert.ok(schema.scraplingUser, "schema should export scraplingUser");
    assert.ok(
      schema.scraplingNotifications,
      "schema should export scraplingNotifications",
    );
    assert.ok(
      schema.scraplingNotificationUsers,
      "schema should export scraplingNotificationUsers",
    );
    assert.ok(
      schema.scraplingNotificationRecords,
      "schema should export scraplingNotificationRecords",
    );
  });

  it("creates users and verifies multi-to-multi relationships with notifications & records", async () => {
    let pool;
    try {
      pool = createPgPool();
      // Test DB connection ping
      await pool.query("SELECT 1");
    } catch {
      // If DB is offline in test runner environment, skip live DB test gracefully
      return;
    }

    try {
      // 1. Create 2 test users (testing default and custom TZ)
      const email1 = `test-user-1-${Date.now()}@example.com`;
      const email2 = `test-user-2-${Date.now()}@example.com`;

      const user1 = await upsertDbUser(
        { email: email1, name: "Test User One" },
        pool,
      );
      const user2 = await upsertDbUser(
        {
          email: email2,
          name: "Test User Two",
          tz: "America/New_York",
        },
        pool,
      );

      assert.ok(user1.id, "User 1 should have UUID id");
      assert.ok(user2.id, "User 2 should have UUID id");
      assert.equal(user1.email, email1);
      assert.equal(user2.email, email2);
      assert.equal(user1.tz, "America/Los_Angeles", "User 1 should default to America/Los_Angeles TZ");
      assert.equal(user2.tz, "America/New_York", "User 2 should have custom America/New_York TZ");

      // Verify scrapling."user" view queries properly
      const userViewRes = await pool.query<{ id: string; email: string; tz: string }>(
        'SELECT id, email, tz FROM scrapling."user" WHERE id = $1',
        [user1.id],
      );
      assert.equal(userViewRes.rows.length, 1);
      assert.equal(userViewRes.rows[0].email, email1);
      assert.equal(userViewRes.rows[0].tz, "America/Los_Angeles");

      // Verify getDbUsers contains our users
      const allUsers = await getDbUsers(pool);
      assert.ok(allUsers.some((u) => u.id === user1.id && u.tz === "America/Los_Angeles"));
      assert.ok(allUsers.some((u) => u.id === user2.id && u.tz === "America/New_York"));

      // 2. Query an existing record from scrapling.records to link to
      const recordRes = await pool.query<{ id: string }>(
        "SELECT id FROM scrapling.records LIMIT 2",
      );
      const sampleRecordIds = recordRes.rows.map((r) => r.id);

      // 3. Create Notification 1 sent to both user1 and user2 (one notification -> many users)
      const html1 = "<h1>Deal Alert!</h1><p>Save 30% on Steam Gift Cards</p>";
      const notif1 = await createDbNotification(
        {
          subject: "Special Deal Alert 1",
          content: html1,
          userIds: [user1.id, user2.id],
          recordIds: sampleRecordIds,
        },
        pool,
      );

      assert.ok(notif1.id, "Notification 1 should have UUID id");
      assert.equal(notif1.content, html1);
      assert.equal(notif1.subject, "Special Deal Alert 1");
      assert.equal(notif1.userIds.length, 2);

      // 4. Create Notification 2 sent to user1 (demonstrating user1 has multiple notifications)
      const html2 = "<p>Weekend Promo Notification</p>";
      const notif2 = await createDbNotification(
        {
          subject: "Special Deal Alert 2",
          content: html2,
          userIds: [user1.id],
          recordIds: sampleRecordIds.slice(0, 1),
        },
        pool,
      );

      assert.ok(notif2.id, "Notification 2 should have UUID id");
      assert.equal(notif2.userIds.length, 1);

      // 5. Query notifications via getDbNotifications
      const notifs = await getDbNotifications({ limit: 10 }, pool);
      const fetched1 = notifs.find((n) => n.id === notif1.id);
      const fetched2 = notifs.find((n) => n.id === notif2.id);

      assert.ok(fetched1, "Notification 1 should be returned");
      assert.ok(fetched2, "Notification 2 should be returned");
      assert.ok(fetched1.userIds.includes(user1.id));
      assert.ok(fetched1.userIds.includes(user2.id));
      assert.ok(fetched2.userIds.includes(user1.id));

      // 6. Verify junction tables directly
      const userNotifsRes = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text as count FROM scrapling.notification_users WHERE user_id = $1",
        [user1.id],
      );
      assert.equal(
        parseInt(userNotifsRes.rows[0].count, 10),
        2,
        "User 1 should have 2 notifications linked",
      );

      // 7. Verify cascade delete: deleting notification 1 cascades to remove its junction rows
      await pool.query("DELETE FROM scrapling.notifications WHERE id = $1", [
        notif1.id,
      ]);

      const junctionUserCheck = await pool.query(
        "SELECT * FROM scrapling.notification_users WHERE notification_id = $1",
        [notif1.id],
      );
      assert.equal(
        junctionUserCheck.rows.length,
        0,
        "Junction rows in notification_users should be cascade deleted",
      );

      const junctionRecordCheck = await pool.query(
        "SELECT * FROM scrapling.notification_records WHERE notification_id = $1",
        [notif1.id],
      );
      assert.equal(
        junctionRecordCheck.rows.length,
        0,
        "Junction rows in notification_records should be cascade deleted",
      );

      // Cleanup remaining test notification and test users
      await pool.query("DELETE FROM scrapling.notifications WHERE id = $1", [
        notif2.id,
      ]);
      await pool.query("DELETE FROM scrapling.users WHERE id IN ($1, $2)", [
        user1.id,
        user2.id,
      ]);
    } finally {
      await pool.end();
    }
  });
});
