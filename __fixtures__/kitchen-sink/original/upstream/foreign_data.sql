--
-- Test foreign-data wrapper and server management.
--

-- Clean up in case a prior regression run failed

-- Suppress NOTICE messages when roles don't exist
SET client_min_messages TO 'error';

DROP ROLE IF EXISTS foreign_data_user, regress_test_role, regress_test_role2, regress_test_role_super, regress_test_indirect, unpriviled_role;

RESET client_min_messages;

CREATE ROLE foreign_data_user LOGIN SUPERUSER;
SET SESSION AUTHORIZATION 'foreign_data_user';

CREATE ROLE regress_test_role;
CREATE ROLE regress_test_role2;
CREATE ROLE regress_test_role_super SUPERUSER;
CREATE ROLE regress_test_indirect;
CREATE ROLE unprivileged_role;

CREATE FOREIGN DATA WRAPPER dummy;
COMMENT ON FOREIGN DATA WRAPPER dummy IS 'useless';
CREATE FOREIGN DATA WRAPPER postgresql VALIDATOR postgresql_fdw_validator;

-- At this point we should have 2 built-in wrappers and no servers.
SELECT fdwname, fdwhandler::regproc, fdwvalidator::regproc, fdwoptions FROM pg_foreign_data_wrapper ORDER BY 1, 2, 3;
SELECT srvname, srvoptions FROM pg_foreign_server;
SELECT * FROM pg_user_mapping;

-- CREATE FOREIGN DATA WRAPPER
CREATE FOREIGN DATA WRAPPER foo VALIDATOR bar;            -- ERROR
CREATE FOREIGN DATA WRAPPER foo;



CREATE FOREIGN DATA WRAPPER foo; -- duplicate
DROP FOREIGN DATA WRAPPER foo;
CREATE FOREIGN DATA WRAPPER foo OPTIONS (testing '1');



DROP FOREIGN DATA WRAPPER foo;
CREATE FOREIGN DATA WRAPPER foo OPTIONS (testing '1', testing '2');   -- ERROR
CREATE FOREIGN DATA WRAPPER foo OPTIONS (testing '1', another '2');



DROP FOREIGN DATA WRAPPER foo;
SET ROLE regress_test_role;
CREATE FOREIGN DATA WRAPPER foo; -- ERROR
RESET ROLE;
CREATE FOREIGN DATA WRAPPER foo VALIDATOR postgresql_fdw_validator;



-- ALTER FOREIGN DATA WRAPPER
ALTER FOREIGN DATA WRAPPER foo NO VALIDATOR;



ALTER FOREIGN DATA WRAPPER foo OPTIONS (a '1', b '2');
-- ALTER FOREIGN DATA WRAPPER foo OPTIONS (SET c '4');         -- ERROR
-- ALTER FOREIGN DATA WRAPPER foo OPTIONS (DROP c);            -- ERROR
ALTER FOREIGN DATA WRAPPER foo OPTIONS (ADD x '1', DROP x);



ALTER FOREIGN DATA WRAPPER foo OPTIONS (DROP a, SET b '3', ADD c '4');



ALTER FOREIGN DATA WRAPPER foo OPTIONS (a '2');
-- ALTER FOREIGN DATA WRAPPER foo OPTIONS (b '4');             -- ERROR



SET ROLE regress_test_role;
-- ALTER FOREIGN DATA WRAPPER foo OPTIONS (ADD d '5');         -- ERROR
SET ROLE regress_test_role_super;
ALTER FOREIGN DATA WRAPPER foo OPTIONS (ADD d '5');



-- ALTER FOREIGN DATA WRAPPER foo OWNER TO regress_test_role;  -- ERROR
ALTER FOREIGN DATA WRAPPER foo OWNER TO regress_test_role_super;
ALTER ROLE regress_test_role_super NOSUPERUSER;
SET ROLE regress_test_role_super;
-- ALTER FOREIGN DATA WRAPPER foo OPTIONS (ADD e '6');         -- ERROR
RESET ROLE;



ALTER FOREIGN DATA WRAPPER foo RENAME TO foo1;


ALTER FOREIGN DATA WRAPPER foo1 RENAME TO foo;

-- DROP FOREIGN DATA WRAPPER
-- DROP FOREIGN DATA WRAPPER nonexistent;                      -- ERROR
DROP FOREIGN DATA WRAPPER IF EXISTS nonexistent;



-- DROP ROLE regress_test_role_super;                          -- ERROR
SET ROLE regress_test_role_super;
DROP FOREIGN DATA WRAPPER foo;
RESET ROLE;
DROP ROLE regress_test_role_super;



CREATE FOREIGN DATA WRAPPER foo;
CREATE SERVER s1 FOREIGN DATA WRAPPER foo;
COMMENT ON SERVER s1 IS 'foreign server';
CREATE USER MAPPING FOR current_user SERVER s1;






-- DROP FOREIGN DATA WRAPPER foo;                              -- ERROR
SET ROLE regress_test_role;
-- DROP FOREIGN DATA WRAPPER foo CASCADE;                      -- ERROR
RESET ROLE;
DROP FOREIGN DATA WRAPPER foo CASCADE;







-- exercise CREATE SERVER
-- CREATE SERVER s1 FOREIGN DATA WRAPPER foo;                  -- ERROR
CREATE FOREIGN DATA WRAPPER foo OPTIONS ("test wrapper" 'true');
CREATE SERVER s1 FOREIGN DATA WRAPPER foo;
-- CREATE SERVER s1 FOREIGN DATA WRAPPER foo;                  -- ERROR
CREATE SERVER s2 FOREIGN DATA WRAPPER foo OPTIONS (host 'a', dbname 'b');
CREATE SERVER s3 TYPE 'oracle' FOREIGN DATA WRAPPER foo;
CREATE SERVER s4 TYPE 'oracle' FOREIGN DATA WRAPPER foo OPTIONS (host 'a', dbname 'b');
CREATE SERVER s5 VERSION '15.0' FOREIGN DATA WRAPPER foo;
CREATE SERVER s6 VERSION '16.0' FOREIGN DATA WRAPPER foo OPTIONS (host 'a', dbname 'b');
CREATE SERVER s7 TYPE 'oracle' VERSION '17.0' FOREIGN DATA WRAPPER foo OPTIONS (host 'a', dbname 'b');
CREATE SERVER s8 FOREIGN DATA WRAPPER postgresql OPTIONS (foo '1'); -- ERROR
CREATE SERVER s8 FOREIGN DATA WRAPPER postgresql OPTIONS (host 'localhost', dbname 's8db');


SET ROLE regress_test_role;
-- CREATE SERVER t1 FOREIGN DATA WRAPPER foo;                 -- ERROR: no usage on FDW
RESET ROLE;
GRANT USAGE ON FOREIGN DATA WRAPPER foo TO regress_test_role;
SET ROLE regress_test_role;
CREATE SERVER t1 FOREIGN DATA WRAPPER foo;
RESET ROLE;



REVOKE USAGE ON FOREIGN DATA WRAPPER foo FROM regress_test_role;
GRANT USAGE ON FOREIGN DATA WRAPPER foo TO regress_test_indirect;
SET ROLE regress_test_role;
-- CREATE SERVER t2 FOREIGN DATA WRAPPER foo;                 -- ERROR
RESET ROLE;
GRANT regress_test_indirect TO regress_test_role;
SET ROLE regress_test_role;
CREATE SERVER t2 FOREIGN DATA WRAPPER foo;


RESET ROLE;
REVOKE regress_test_indirect FROM regress_test_role;

-- ALTER SERVER
-- ALTER SERVER s0;                                            -- ERROR
-- ALTER SERVER s0 OPTIONS (a '1');                            -- ERROR
ALTER SERVER s1 VERSION '1.0' OPTIONS (servername 's1');
ALTER SERVER s2 VERSION '1.1';
ALTER SERVER s3 OPTIONS ("tns name" 'orcl', port '1521');
GRANT USAGE ON FOREIGN SERVER s1 TO regress_test_role;
GRANT USAGE ON FOREIGN SERVER s6 TO regress_test_role2 WITH GRANT OPTION;


SET ROLE regress_test_role;
-- ALTER SERVER s1 VERSION '1.1';                              -- ERROR
ALTER SERVER s1 OWNER TO regress_test_role;                 -- ERROR
RESET ROLE;
ALTER SERVER s1 OWNER TO regress_test_role;
GRANT regress_test_role2 TO regress_test_role;
SET ROLE regress_test_role;
ALTER SERVER s1 VERSION '1.1';
ALTER SERVER s1 OWNER TO regress_test_role2;                -- ERROR
RESET ROLE;
ALTER SERVER s8 OPTIONS (foo '1');                          -- ERROR option validation
ALTER SERVER s8 OPTIONS (connect_timeout '30', SET dbname 'db1', DROP host);
SET ROLE regress_test_role;
ALTER SERVER s1 OWNER TO regress_test_indirect;             -- ERROR
RESET ROLE;
GRANT regress_test_indirect TO regress_test_role;
SET ROLE regress_test_role;
ALTER SERVER s1 OWNER TO regress_test_indirect;
RESET ROLE;
GRANT USAGE ON FOREIGN DATA WRAPPER foo TO regress_test_indirect;
SET ROLE regress_test_role;
ALTER SERVER s1 OWNER TO regress_test_indirect;
RESET ROLE;
DROP ROLE regress_test_indirect;                            -- ERROR



ALTER SERVER s8 RENAME to s8new;


ALTER SERVER s8new RENAME to s8;

-- DROP SERVER
DROP SERVER nonexistent;                                    -- ERROR
DROP SERVER IF EXISTS nonexistent;


SET ROLE regress_test_role;
DROP SERVER s2;                                             -- ERROR
DROP SERVER s1;
RESET ROLE;


ALTER SERVER s2 OWNER TO regress_test_role;
SET ROLE regress_test_role;
DROP SERVER s2;
RESET ROLE;


CREATE USER MAPPING FOR current_user SERVER s3;


DROP SERVER s3;                                             -- ERROR
DROP SERVER s3 CASCADE;





-- CREATE USER MAPPING
CREATE USER MAPPING FOR regress_test_missing_role SERVER s1;  -- ERROR
CREATE USER MAPPING FOR current_user SERVER s1;             -- ERROR
CREATE USER MAPPING FOR current_user SERVER s4;
CREATE USER MAPPING FOR user SERVER s4;                     -- ERROR duplicate
CREATE USER MAPPING FOR public SERVER s4 OPTIONS ("this mapping" 'is public');
CREATE USER MAPPING FOR user SERVER s8 OPTIONS (username 'test', password 'secret');    -- ERROR
CREATE USER MAPPING FOR user SERVER s8 OPTIONS (user 'test', password 'secret');
ALTER SERVER s5 OWNER TO regress_test_role;
ALTER SERVER s6 OWNER TO regress_test_indirect;
SET ROLE regress_test_role;
CREATE USER MAPPING FOR current_user SERVER s5;
CREATE USER MAPPING FOR current_user SERVER s6 OPTIONS (username 'test');
CREATE USER MAPPING FOR current_user SERVER s7;             -- ERROR
CREATE USER MAPPING FOR public SERVER s8;                   -- ERROR
RESET ROLE;

ALTER SERVER t1 OWNER TO regress_test_indirect;
SET ROLE regress_test_role;
CREATE USER MAPPING FOR current_user SERVER t1 OPTIONS (username 'bob', password 'boo');
CREATE USER MAPPING FOR public SERVER t1;
RESET ROLE;



-- ALTER USER MAPPING
ALTER USER MAPPING FOR regress_test_missing_role SERVER s4 OPTIONS (gotcha 'true'); -- ERROR
ALTER USER MAPPING FOR user SERVER ss4 OPTIONS (gotcha 'true'); -- ERROR
ALTER USER MAPPING FOR public SERVER s5 OPTIONS (gotcha 'true');            -- ERROR
ALTER USER MAPPING FOR current_user SERVER s8 OPTIONS (username 'test');    -- ERROR
ALTER USER MAPPING FOR current_user SERVER s8 OPTIONS (DROP user, SET password 'public');
SET ROLE regress_test_role;
ALTER USER MAPPING FOR current_user SERVER s5 OPTIONS (ADD modified '1');
ALTER USER MAPPING FOR public SERVER s4 OPTIONS (ADD modified '1'); -- ERROR
ALTER USER MAPPING FOR public SERVER t1 OPTIONS (ADD modified '1');
RESET ROLE;



-- DROP USER MAPPING
DROP USER MAPPING FOR regress_test_missing_role SERVER s4;  -- ERROR
DROP USER MAPPING FOR user SERVER ss4;
DROP USER MAPPING FOR public SERVER s7;                     -- ERROR
DROP USER MAPPING IF EXISTS FOR regress_test_missing_role SERVER s4;
DROP USER MAPPING IF EXISTS FOR user SERVER ss4;
DROP USER MAPPING IF EXISTS FOR public SERVER s7;
CREATE USER MAPPING FOR public SERVER s8;
SET ROLE regress_test_role;
DROP USER MAPPING FOR public SERVER s8;                     -- ERROR
RESET ROLE;
DROP SERVER s7;



-- CREATE FOREIGN TABLE
CREATE SCHEMA foreign_schema;
CREATE SERVER s0 FOREIGN DATA WRAPPER dummy;
-- CREATE FOREIGN TABLE ft1 ();                                    -- ERROR
CREATE FOREIGN TABLE ft1 () SERVER no_server;                   -- ERROR
CREATE FOREIGN TABLE ft1 (
	c1 integer OPTIONS ("param 1" 'val1') PRIMARY KEY,
	c2 text OPTIONS (param2 'val2', param3 'val3'),
	c3 date
) SERVER s0 OPTIONS (delimiter ',', quote '"', "be quoted" 'value'); -- ERROR
CREATE TABLE ref_table (id integer PRIMARY KEY);
CREATE FOREIGN TABLE ft1 (
	c1 integer OPTIONS ("param 1" 'val1') REFERENCES ref_table (id),
	c2 text OPTIONS (param2 'val2', param3 'val3'),
	c3 date
) SERVER s0 OPTIONS (delimiter ',', quote '"', "be quoted" 'value'); -- ERROR
DROP TABLE ref_table;
CREATE FOREIGN TABLE ft1 (
	c1 integer OPTIONS ("param 1" 'val1') NOT NULL,
	c2 text OPTIONS (param2 'val2', param3 'val3'),
	c3 date,
	UNIQUE (c3)
) SERVER s0 OPTIONS (delimiter ',', quote '"', "be quoted" 'value'); -- ERROR
CREATE FOREIGN TABLE ft1 (
	c1 integer OPTIONS ("param 1" 'val1') NOT NULL,
	c2 text OPTIONS (param2 'val2', param3 'val3') CHECK (c2 <> ''),
	c3 date,
	CHECK (c3 BETWEEN '1994-01-01'::date AND '1994-01-31'::date)
) SERVER s0 OPTIONS (delimiter ',', quote '"', "be quoted" 'value');
COMMENT ON FOREIGN TABLE ft1 IS 'ft1';
COMMENT ON COLUMN ft1.c1 IS 'ft1.c1';




CREATE INDEX id_ft1_c2 ON ft1 (c2);                             -- ERROR
SELECT * FROM ft1;                                              -- ERROR
EXPLAIN SELECT * FROM ft1;                                      -- ERROR

-- ALTER FOREIGN TABLE
COMMENT ON FOREIGN TABLE ft1 IS 'foreign table';
COMMENT ON FOREIGN TABLE ft1 IS NULL;
COMMENT ON COLUMN ft1.c1 IS 'foreign column';
COMMENT ON COLUMN ft1.c1 IS NULL;

ALTER FOREIGN TABLE ft1 ADD COLUMN c4 integer;
ALTER FOREIGN TABLE ft1 ADD COLUMN c5 integer DEFAULT 0;
ALTER FOREIGN TABLE ft1 ADD COLUMN c6 integer;
ALTER FOREIGN TABLE ft1 ADD COLUMN c7 integer NOT NULL;
ALTER FOREIGN TABLE ft1 ADD COLUMN c8 integer;
ALTER FOREIGN TABLE ft1 ADD COLUMN c9 integer;
ALTER FOREIGN TABLE ft1 ADD COLUMN c10 integer OPTIONS (p1 'v1');

ALTER FOREIGN TABLE ft1 ALTER COLUMN c4 SET DEFAULT 0;
ALTER FOREIGN TABLE ft1 ALTER COLUMN c5 DROP DEFAULT;
ALTER FOREIGN TABLE ft1 ALTER COLUMN c6 SET NOT NULL;
ALTER FOREIGN TABLE ft1 ALTER COLUMN c7 DROP NOT NULL;
ALTER FOREIGN TABLE ft1 ALTER COLUMN c8 TYPE char(10) USING '0'; -- ERROR
ALTER FOREIGN TABLE ft1 ALTER COLUMN c8 TYPE char(10);
ALTER FOREIGN TABLE ft1 ALTER COLUMN c8 SET DATA TYPE text;
ALTER FOREIGN TABLE ft1 ALTER COLUMN xmin OPTIONS (ADD p1 'v1'); -- ERROR
ALTER FOREIGN TABLE ft1 ALTER COLUMN c7 OPTIONS (ADD p1 'v1', ADD p2 'v2'),
                        ALTER COLUMN c8 OPTIONS (ADD p1 'v1', ADD p2 'v2');
ALTER FOREIGN TABLE ft1 ALTER COLUMN c8 OPTIONS (SET p2 'V2', DROP p1);
ALTER FOREIGN TABLE ft1 ALTER COLUMN c1 SET STATISTICS 10000;
ALTER FOREIGN TABLE ft1 ALTER COLUMN c1 SET (n_distinct = 100);
ALTER FOREIGN TABLE ft1 ALTER COLUMN c8 SET STATISTICS -1;
ALTER FOREIGN TABLE ft1 ALTER COLUMN c8 SET STORAGE PLAIN;


-- can't change the column type if it's used elsewhere
CREATE TABLE use_ft1_column_type (x ft1);
ALTER FOREIGN TABLE ft1 ALTER COLUMN c8 SET DATA TYPE integer;	-- ERROR
DROP TABLE use_ft1_column_type;
ALTER FOREIGN TABLE ft1 ADD PRIMARY KEY (c7);                   -- ERROR
ALTER FOREIGN TABLE ft1 ADD CONSTRAINT ft1_c9_check CHECK (c9 < 0) NOT VALID;
-- ALTER FOREIGN TABLE ft1 ALTER CONSTRAINT ft1_c9_check DEFERRABLE; -- ERROR
ALTER FOREIGN TABLE ft1 DROP CONSTRAINT ft1_c9_check;
ALTER FOREIGN TABLE ft1 DROP CONSTRAINT no_const;               -- ERROR
ALTER FOREIGN TABLE ft1 DROP CONSTRAINT IF EXISTS no_const;
-- ALTER FOREIGN TABLE ft1 SET WITH OIDS;
ALTER FOREIGN TABLE ft1 OWNER TO regress_test_role;
ALTER FOREIGN TABLE ft1 OPTIONS (DROP delimiter, SET quote '~', ADD escape '@');
ALTER FOREIGN TABLE ft1 DROP COLUMN no_column;                  -- ERROR
ALTER FOREIGN TABLE ft1 DROP COLUMN IF EXISTS no_column;
ALTER FOREIGN TABLE ft1 DROP COLUMN c9;
ALTER FOREIGN TABLE ft1 SET SCHEMA foreign_schema;
ALTER FOREIGN TABLE ft1 SET TABLESPACE ts;                      -- ERROR
ALTER FOREIGN TABLE foreign_schema.ft1 RENAME c1 TO foreign_column_1;
ALTER FOREIGN TABLE foreign_schema.ft1 RENAME TO foreign_table_1;



-- alter noexisting table
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 ADD COLUMN c4 integer;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 ADD COLUMN c6 integer;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 ADD COLUMN c7 integer NOT NULL;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 ADD COLUMN c8 integer;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 ADD COLUMN c9 integer;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 ADD COLUMN c10 integer OPTIONS (p1 'v1');

ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 ALTER COLUMN c6 SET NOT NULL;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 ALTER COLUMN c7 DROP NOT NULL;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 ALTER COLUMN c8 TYPE char(10);
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 ALTER COLUMN c8 SET DATA TYPE text;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 ALTER COLUMN c7 OPTIONS (ADD p1 'v1', ADD p2 'v2'),
                        ALTER COLUMN c8 OPTIONS (ADD p1 'v1', ADD p2 'v2');
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 ALTER COLUMN c8 OPTIONS (SET p2 'V2', DROP p1);

ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 DROP CONSTRAINT IF EXISTS no_const;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 DROP CONSTRAINT ft1_c1_check;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 OWNER TO regress_test_role;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 OPTIONS (DROP delimiter, SET quote '~', ADD escape '@');
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 DROP COLUMN IF EXISTS no_column;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 DROP COLUMN c9;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 SET SCHEMA foreign_schema;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 RENAME c1 TO foreign_column_1;
ALTER FOREIGN TABLE IF EXISTS doesnt_exist_ft1 RENAME TO foreign_table_1;

-- Information schema

SELECT * FROM information_schema.foreign_data_wrappers ORDER BY 1, 2;
SELECT * FROM information_schema.foreign_data_wrapper_options ORDER BY 1, 2, 3;
SELECT * FROM information_schema.foreign_servers ORDER BY 1, 2;
SELECT * FROM information_schema.foreign_server_options ORDER BY 1, 2, 3;
SELECT * FROM information_schema.user_mappings ORDER BY lower(authorization_identifier), 2, 3;
SELECT * FROM information_schema.user_mapping_options ORDER BY lower(authorization_identifier), 2, 3, 4;
SELECT * FROM information_schema.usage_privileges WHERE object_type LIKE 'FOREIGN%' AND object_name IN ('s6', 'foo') ORDER BY 1, 2, 3, 4, 5;
SELECT * FROM information_schema.role_usage_grants WHERE object_type LIKE 'FOREIGN%' AND object_name IN ('s6', 'foo') ORDER BY 1, 2, 3, 4, 5;
SELECT * FROM information_schema.foreign_tables ORDER BY 1, 2, 3;
SELECT * FROM information_schema.foreign_table_options ORDER BY 1, 2, 3, 4;
SET ROLE regress_test_role;
SELECT * FROM information_schema.user_mapping_options ORDER BY 1, 2, 3, 4;
SELECT * FROM information_schema.usage_privileges WHERE object_type LIKE 'FOREIGN%' AND object_name IN ('s6', 'foo') ORDER BY 1, 2, 3, 4, 5;
SELECT * FROM information_schema.role_usage_grants WHERE object_type LIKE 'FOREIGN%' AND object_name IN ('s6', 'foo') ORDER BY 1, 2, 3, 4, 5;
DROP USER MAPPING FOR current_user SERVER t1;
SET ROLE regress_test_role2;
SELECT * FROM information_schema.user_mapping_options ORDER BY 1, 2, 3, 4;
RESET ROLE;


-- has_foreign_data_wrapper_privilege
SELECT has_foreign_data_wrapper_privilege('regress_test_role',
    (SELECT oid FROM pg_foreign_data_wrapper WHERE fdwname='foo'), 'USAGE');
SELECT has_foreign_data_wrapper_privilege('regress_test_role', 'foo', 'USAGE');
SELECT has_foreign_data_wrapper_privilege(
    (SELECT oid FROM pg_roles WHERE rolname='regress_test_role'),
    (SELECT oid FROM pg_foreign_data_wrapper WHERE fdwname='foo'), 'USAGE');
SELECT has_foreign_data_wrapper_privilege(
    (SELECT oid FROM pg_foreign_data_wrapper WHERE fdwname='foo'), 'USAGE');
SELECT has_foreign_data_wrapper_privilege(
    (SELECT oid FROM pg_roles WHERE rolname='regress_test_role'), 'foo', 'USAGE');
SELECT has_foreign_data_wrapper_privilege('foo', 'USAGE');
GRANT USAGE ON FOREIGN DATA WRAPPER foo TO regress_test_role;
SELECT has_foreign_data_wrapper_privilege('regress_test_role', 'foo', 'USAGE');

-- has_server_privilege
SELECT has_server_privilege('regress_test_role',
    (SELECT oid FROM pg_foreign_server WHERE srvname='s8'), 'USAGE');
SELECT has_server_privilege('regress_test_role', 's8', 'USAGE');
SELECT has_server_privilege(
    (SELECT oid FROM pg_roles WHERE rolname='regress_test_role'),
    (SELECT oid FROM pg_foreign_server WHERE srvname='s8'), 'USAGE');
SELECT has_server_privilege(
    (SELECT oid FROM pg_foreign_server WHERE srvname='s8'), 'USAGE');
SELECT has_server_privilege(
    (SELECT oid FROM pg_roles WHERE rolname='regress_test_role'), 's8', 'USAGE');
SELECT has_server_privilege('s8', 'USAGE');
GRANT USAGE ON FOREIGN SERVER s8 TO regress_test_role;
SELECT has_server_privilege('regress_test_role', 's8', 'USAGE');
REVOKE USAGE ON FOREIGN SERVER s8 FROM regress_test_role;

GRANT USAGE ON FOREIGN SERVER s4 TO regress_test_role;
DROP USER MAPPING FOR public SERVER s4;
ALTER SERVER s6 OPTIONS (DROP host, DROP dbname);
ALTER USER MAPPING FOR regress_test_role SERVER s6 OPTIONS (DROP username);
ALTER FOREIGN DATA WRAPPER foo VALIDATOR postgresql_fdw_validator;

-- Privileges
SET ROLE unprivileged_role;
CREATE FOREIGN DATA WRAPPER foobar;                             -- ERROR
ALTER FOREIGN DATA WRAPPER foo OPTIONS (gotcha 'true');         -- ERROR
ALTER FOREIGN DATA WRAPPER foo OWNER TO unprivileged_role;      -- ERROR
DROP FOREIGN DATA WRAPPER foo;                                  -- ERROR
GRANT USAGE ON FOREIGN DATA WRAPPER foo TO regress_test_role;   -- ERROR
CREATE SERVER s9 FOREIGN DATA WRAPPER foo;                      -- ERROR
ALTER SERVER s4 VERSION '0.5';                                  -- ERROR
ALTER SERVER s4 OWNER TO unprivileged_role;                     -- ERROR
DROP SERVER s4;                                                 -- ERROR
GRANT USAGE ON FOREIGN SERVER s4 TO regress_test_role;          -- ERROR
CREATE USER MAPPING FOR public SERVER s4;                       -- ERROR
ALTER USER MAPPING FOR regress_test_role SERVER s6 OPTIONS (gotcha 'true'); -- ERROR
DROP USER MAPPING FOR regress_test_role SERVER s6;              -- ERROR
RESET ROLE;

GRANT USAGE ON FOREIGN DATA WRAPPER postgresql TO unprivileged_role;
GRANT USAGE ON FOREIGN DATA WRAPPER foo TO unprivileged_role WITH GRANT OPTION;
SET ROLE unprivileged_role;
CREATE FOREIGN DATA WRAPPER foobar;                             -- ERROR
ALTER FOREIGN DATA WRAPPER foo OPTIONS (gotcha 'true');         -- ERROR
DROP FOREIGN DATA WRAPPER foo;                                  -- ERROR
GRANT USAGE ON FOREIGN DATA WRAPPER postgresql TO regress_test_role; -- WARNING
GRANT USAGE ON FOREIGN DATA WRAPPER foo TO regress_test_role;
CREATE SERVER s9 FOREIGN DATA WRAPPER postgresql;
ALTER SERVER s6 VERSION '0.5';                                  -- ERROR
DROP SERVER s6;                                                 -- ERROR
GRANT USAGE ON FOREIGN SERVER s6 TO regress_test_role;          -- ERROR
GRANT USAGE ON FOREIGN SERVER s9 TO regress_test_role;
CREATE USER MAPPING FOR public SERVER s6;                       -- ERROR
CREATE USER MAPPING FOR public SERVER s9;
ALTER USER MAPPING FOR regress_test_role SERVER s6 OPTIONS (gotcha 'true'); -- ERROR
DROP USER MAPPING FOR regress_test_role SERVER s6;              -- ERROR
RESET ROLE;

REVOKE USAGE ON FOREIGN DATA WRAPPER foo FROM unprivileged_role; -- ERROR
REVOKE USAGE ON FOREIGN DATA WRAPPER foo FROM unprivileged_role CASCADE;
SET ROLE unprivileged_role;
GRANT USAGE ON FOREIGN DATA WRAPPER foo TO regress_test_role;   -- ERROR
CREATE SERVER s10 FOREIGN DATA WRAPPER foo;                     -- ERROR
ALTER SERVER s9 VERSION '1.1';
GRANT USAGE ON FOREIGN SERVER s9 TO regress_test_role;
CREATE USER MAPPING FOR current_user SERVER s9;
DROP SERVER s9 CASCADE;
RESET ROLE;
CREATE SERVER s9 FOREIGN DATA WRAPPER foo;
GRANT USAGE ON FOREIGN SERVER s9 TO unprivileged_role;
SET ROLE unprivileged_role;
ALTER SERVER s9 VERSION '1.2';                                  -- ERROR
GRANT USAGE ON FOREIGN SERVER s9 TO regress_test_role;          -- WARNING
CREATE USER MAPPING FOR current_user SERVER s9;
DROP SERVER s9 CASCADE;                                         -- ERROR
RESET ROLE;

-- Triggers
CREATE FUNCTION dummy_trigger() RETURNS TRIGGER AS $$
  BEGIN
    RETURN NULL;
  END
$$ language plpgsql;

CREATE TRIGGER trigtest_before_stmt BEFORE INSERT OR UPDATE OR DELETE
ON foreign_schema.foreign_table_1
FOR EACH STATEMENT
EXECUTE PROCEDURE dummy_trigger();

CREATE TRIGGER trigtest_after_stmt AFTER INSERT OR UPDATE OR DELETE
ON foreign_schema.foreign_table_1
FOR EACH STATEMENT
EXECUTE PROCEDURE dummy_trigger();

CREATE TRIGGER trigtest_before_row BEFORE INSERT OR UPDATE OR DELETE
ON foreign_schema.foreign_table_1
FOR EACH ROW
EXECUTE PROCEDURE dummy_trigger();

CREATE TRIGGER trigtest_after_row AFTER INSERT OR UPDATE OR DELETE
ON foreign_schema.foreign_table_1
FOR EACH ROW
EXECUTE PROCEDURE dummy_trigger();

CREATE CONSTRAINT TRIGGER trigtest_constraint AFTER INSERT OR UPDATE OR DELETE
ON foreign_schema.foreign_table_1
FOR EACH ROW
EXECUTE PROCEDURE dummy_trigger();

ALTER FOREIGN TABLE foreign_schema.foreign_table_1
	DISABLE TRIGGER trigtest_before_stmt;
ALTER FOREIGN TABLE foreign_schema.foreign_table_1
	ENABLE TRIGGER trigtest_before_stmt;

DROP TRIGGER trigtest_before_stmt ON foreign_schema.foreign_table_1;
DROP TRIGGER trigtest_before_row ON foreign_schema.foreign_table_1;
DROP TRIGGER trigtest_after_stmt ON foreign_schema.foreign_table_1;
DROP TRIGGER trigtest_after_row ON foreign_schema.foreign_table_1;

DROP FUNCTION dummy_trigger();

-- Table inheritance
CREATE TABLE pt1 (
	c1 integer NOT NULL,
	c2 text,
	c3 date
);
CREATE FOREIGN TABLE ft2 () INHERITS (pt1)
  SERVER s0 OPTIONS (delimiter ',', quote '"', "be quoted" 'value');




DROP FOREIGN TABLE ft2;


CREATE FOREIGN TABLE ft2 (
	c1 integer NOT NULL,
	c2 text,
	c3 date
) SERVER s0 OPTIONS (delimiter ',', quote '"', "be quoted" 'value');


ALTER FOREIGN TABLE ft2 INHERIT pt1;




CREATE TABLE ct3() INHERITS(ft2);
CREATE FOREIGN TABLE ft3 (
	c1 integer NOT NULL,
	c2 text,
	c3 date
) INHERITS(ft2)
  SERVER s0;







-- add attributes recursively
ALTER TABLE pt1 ADD COLUMN c4 integer;
ALTER TABLE pt1 ADD COLUMN c5 integer DEFAULT 0;
ALTER TABLE pt1 ADD COLUMN c6 integer;
ALTER TABLE pt1 ADD COLUMN c7 integer NOT NULL;
ALTER TABLE pt1 ADD COLUMN c8 integer;









-- alter attributes recursively
ALTER TABLE pt1 ALTER COLUMN c4 SET DEFAULT 0;
ALTER TABLE pt1 ALTER COLUMN c5 DROP DEFAULT;
ALTER TABLE pt1 ALTER COLUMN c6 SET NOT NULL;
ALTER TABLE pt1 ALTER COLUMN c7 DROP NOT NULL;
ALTER TABLE pt1 ALTER COLUMN c8 TYPE char(10) USING '0';        -- ERROR
ALTER TABLE pt1 ALTER COLUMN c8 TYPE char(10);
ALTER TABLE pt1 ALTER COLUMN c8 SET DATA TYPE text;
ALTER TABLE pt1 ALTER COLUMN c1 SET STATISTICS 10000;
ALTER TABLE pt1 ALTER COLUMN c1 SET (n_distinct = 100);
ALTER TABLE pt1 ALTER COLUMN c8 SET STATISTICS -1;
ALTER TABLE pt1 ALTER COLUMN c8 SET STORAGE EXTERNAL;





-- drop attributes recursively
ALTER TABLE pt1 DROP COLUMN c4;
ALTER TABLE pt1 DROP COLUMN c5;
ALTER TABLE pt1 DROP COLUMN c6;
ALTER TABLE pt1 DROP COLUMN c7;
ALTER TABLE pt1 DROP COLUMN c8;





-- add constraints recursively
ALTER TABLE pt1 ADD CONSTRAINT pt1chk1 CHECK (c1 > 0) NO INHERIT;
ALTER TABLE pt1 ADD CONSTRAINT pt1chk2 CHECK (c2 <> '');
-- connoinherit should be true for NO INHERIT constraint
SELECT relname, conname, contype, conislocal, coninhcount, connoinherit
  FROM pg_class AS pc JOIN pg_constraint AS pgc ON (conrelid = pc.oid)
  WHERE pc.relname = 'pt1'
  ORDER BY 1,2;
-- child does not inherit NO INHERIT constraints




DROP FOREIGN TABLE ft2; -- ERROR
DROP FOREIGN TABLE ft2 CASCADE;
CREATE FOREIGN TABLE ft2 (
	c1 integer NOT NULL,
	c2 text,
	c3 date
) SERVER s0 OPTIONS (delimiter ',', quote '"', "be quoted" 'value');
-- child must have parent's INHERIT constraints
ALTER FOREIGN TABLE ft2 INHERIT pt1;                            -- ERROR
ALTER FOREIGN TABLE ft2 ADD CONSTRAINT pt1chk2 CHECK (c2 <> '');
ALTER FOREIGN TABLE ft2 INHERIT pt1;
-- child does not inherit NO INHERIT constraints





-- drop constraints recursively
ALTER TABLE pt1 DROP CONSTRAINT pt1chk1 CASCADE;
ALTER TABLE pt1 DROP CONSTRAINT pt1chk2 CASCADE;

-- NOT VALID case
INSERT INTO pt1 VALUES (1, 'pt1'::text, '1994-01-01'::date);
ALTER TABLE pt1 ADD CONSTRAINT pt1chk3 CHECK (c2 <> '') NOT VALID;




-- VALIDATE CONSTRAINT need do nothing on foreign tables
ALTER TABLE pt1 VALIDATE CONSTRAINT pt1chk3;





-- OID system column
-- ALTER TABLE pt1 SET WITH OIDS;




-- ALTER TABLE ft2 SET WITHOUT OIDS;  -- ERROR
-- ALTER TABLE pt1 SET WITHOUT OIDS;





-- changes name of an attribute recursively
ALTER TABLE pt1 RENAME COLUMN c1 TO f1;
ALTER TABLE pt1 RENAME COLUMN c2 TO f2;
ALTER TABLE pt1 RENAME COLUMN c3 TO f3;
-- changes name of a constraint recursively
ALTER TABLE pt1 RENAME CONSTRAINT pt1chk3 TO f2_check;





-- TRUNCATE doesn't work on foreign tables, either directly or recursively
TRUNCATE ft2;  -- ERROR
TRUNCATE pt1;  -- ERROR

DROP TABLE pt1 CASCADE;

-- IMPORT FOREIGN SCHEMA
IMPORT FOREIGN SCHEMA s1 FROM SERVER s9 INTO public; -- ERROR
IMPORT FOREIGN SCHEMA s1 LIMIT TO (t1) FROM SERVER s9 INTO public; --ERROR
IMPORT FOREIGN SCHEMA s1 EXCEPT (t1) FROM SERVER s9 INTO public; -- ERROR
IMPORT FOREIGN SCHEMA s1 EXCEPT (t1, t2) FROM SERVER s9 INTO public
OPTIONS (option1 'value1', option2 'value2'); -- ERROR

-- DROP FOREIGN TABLE
DROP FOREIGN TABLE no_table;                                    -- ERROR
DROP FOREIGN TABLE IF EXISTS no_table;
DROP FOREIGN TABLE foreign_schema.foreign_table_1;

-- REASSIGN OWNED/DROP OWNED of foreign objects
REASSIGN OWNED BY regress_test_role TO regress_test_role2;
DROP OWNED BY regress_test_role2;
DROP OWNED BY regress_test_role2 CASCADE;

-- Cleanup
DROP SCHEMA foreign_schema CASCADE;
DROP ROLE regress_test_role;                                -- ERROR
DROP SERVER t1 CASCADE;
DROP USER MAPPING FOR regress_test_role SERVER s6;
-- This test causes some order dependent cascade detail output,
-- so switch to terse mode for it.


DROP FOREIGN DATA WRAPPER foo CASCADE;


DROP SERVER s8 CASCADE;
DROP ROLE regress_test_indirect;
DROP ROLE regress_test_role;
DROP ROLE unprivileged_role;                                -- ERROR
REVOKE ALL ON FOREIGN DATA WRAPPER postgresql FROM unprivileged_role;
DROP ROLE unprivileged_role;
DROP ROLE regress_test_role2;
DROP FOREIGN DATA WRAPPER postgresql CASCADE;
DROP FOREIGN DATA WRAPPER dummy CASCADE;


DROP ROLE foreign_data_user;

-- At this point we should have no wrappers, no servers, and no mappings.
SELECT fdwname, fdwhandler, fdwvalidator, fdwoptions FROM pg_foreign_data_wrapper;
SELECT srvname, srvoptions FROM pg_foreign_server;
SELECT * FROM pg_user_mapping;
